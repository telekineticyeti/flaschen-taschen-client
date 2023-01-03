import dgram from 'dgram';
import fs from 'fs/promises';
import {decompressFrames, ParsedFrame, parseGIF} from 'gifuct-js';
import Jimp from 'jimp';
import fetch from 'node-fetch';
import path from 'path';

/**
 * Class for constructing a binary PPM image file and transmitting it to a remote host via UDP
 * in Flaschen Taschen RGB matrix protocol.
 *
 * PPM file
 * https://netpbm.sourceforge.net/doc/ppm.html
 *
 * FT Protocol
 * https://github.com/hzeller/flaschen-taschen/blob/master/doc/protocols.md
 */
export class FlaschenTaschenClient {
  private port = 1337;
  private readonly defaultImageOptions: ImageOptions = {
    width: 32,
    height: 32,
    layer: 15,
    offsetX: 0,
    offsetY: 0,
  };
  // Suppress debug messages
  public silent = true;

  constructor(private host: string, port?: number) {
    if (port) this.port = port;
  }

  /**
   * Creates and returns a Flaschen Taschen Image class instance.
   * This instance contains the immage binary buffer, in addition to
   * several helper methods for image manipulation.
   */
  public create(options?: ImageOptions): FlaschenTaschenImage {
    const mergedOptions = {...this.defaultImageOptions, ...options};
    return new FlaschenTaschenImage(mergedOptions);
  }

  /**
   * Accetps a FlaschenTaschenImage instance, and transmits the
   * instance buffer to the target host.
   */
  public render(ftImage: FlaschenTaschenImage) {
    const client = dgram.createSocket('udp4');

    client.send(ftImage.buffer, this.port, this.host, (error, bytes) => {
      if (error) throw error;

      if (!this.silent) {
        console.log(`UDP message sent to ${this.host}:${this.port} (${bytes} bytes)`);
      }
      client.close();
    });
  }

  public createPlayer(width: number = 32, height: number = 32): FlaschenTaschenPlayer {
    return new FlaschenTaschenPlayer(this, width, height);
  }
}

/**
 * FT Image Class
 * Creates a binary buffer in PPM image format with FT specific headers.
 * Use the `plot()` method to draw pixels to the image, or the write method
 * to output the buffer to a file in ppm format.
 */
export class FlaschenTaschenImage {
  private header: string;
  private width: number;
  private height: number;
  private readonly ppmFileType = 'P6';
  public buffer: Buffer;

  constructor(options: ImageOptions) {
    this.init(options);
  }

  /**
   * Initialises the PPM binary buffer.
   * Use @link plot() to draw pixels.
   */
  private init(options: ImageOptions) {
    // PPM header packet string
    this.header = `${this.ppmFileType}\n${options.width} ${options.height}\n#FT: ${options.offsetX} ${options.offsetY} ${options.layer}\n255\n`;
    // PPM footer packet string
    const footer = ``;

    this.width = options.width!;
    this.height = options.height!;

    this.buffer = Buffer.alloc(this.header.length + footer.length + options.height! * options.width! * 3);

    this.buffer.write(this.header);
    const start = this.buffer.length - footer.length;
    this.buffer.write(footer, start);
  }

  /**
   * Plot a pixel value in the PPM at the specified coordinates.
   * @param x x coordinate
   * @param y y coordinate
   * @param colour RGB value { r, g, b }
   */
  public plot(x: number, y: number, colour: RGBValue) {
    // Calculate the byte offset in image binary to make adjustments
    let offset = (x + y * this.width) * 3 + this.header.length;

    this.buffer[offset] = colour.r;
    this.buffer[offset + 1] = colour.g;
    this.buffer[offset + 2] = colour.b;
  }

  /**
   * Write the PPM buffer to file
   * @param path Output Path/filename. Example `./image.ppm`
   */
  public write(path: string) {
    fs.writeFile(path, this.buffer);
  }

  /**
   * Wipes the current image by setting every pixel to black.
   */
  public clear() {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        this.plot(x, y, {r: 0, g: 0, b: 0});
      }
    }
  }
}

/**
 * Contains helper methods for continuously broadcasting static or animated images
 * to a Flaschen-taschen client
 */
export class FlaschenTaschenPlayer {
  constructor(private client: FlaschenTaschenClient, private width: number, private height: number) {}
  /**
   * Stores the Timer object that displays the current image/animation.
   * Storing it in this manner allows us to clear the timeout when switching
   * from one image to another.
   */
  public displayTimeout: NodeJS.Timeout;

  /**
   * Play (broadcast) the image to Flaschen-taschen client
   * @param location URL or file path string.
   */
  public async play(location: string) {
    try {
      if (this.isUrl(location)) {
        const response = await fetch(location);
        const contentType = response.headers.get('content-type');

        if (contentType === 'image/gif') {
          const buffer = await response.arrayBuffer();
          this.renderAnimation(buffer);
        } else {
          const buffer = await response.buffer();
          this.renderStatic(buffer);
        }
      } else {
        const file = await fs.readFile(location);
        const fileExt = path.extname(location);
        if (fileExt.toLowerCase().includes('gif')) {
          const buffer = file.buffer;
          this.renderAnimation(buffer);
        } else {
          const buffer = file;
          this.renderStatic(buffer);
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  public stop(): void {
    clearTimeout(this.displayTimeout);
  }

  /**
   * Simple method to attempt to detect if provided string is URL.
   */
  private isUrl(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Converts ParsedFrames from gifuct-js to Flaschen-taschen compatible PPM files,
   * in addition to performing any required post-processing such as resize or contrasting.
   * @param frames gifuct ParsedFrame array.
   * @returns Array of objects containing PPM binary buffers and frame delay values.
   */
  private async createAnimation(
    frames: ParsedFrame[],
    width = 32,
    height = 32,
    layer = 5,
  ): Promise<FTAnimationFrame[]> {
    try {
      if (!frames.length) {
        throw new Error('no frames to process');
      }

      // For most GIF types, frames are 'patched' onto the previous frame.
      let prevFrame: Jimp | undefined;
      let processedFrames: FTAnimationFrame[] = [];

      // For every decompressed frame in the GIF, we create a new Jimp instance to prepare the frames for PPM.
      for (const frame of frames) {
        // If there are no previous frames to work on, create a new frame.
        const jimpFrame = !prevFrame ? new Jimp(frame.dims.width, frame.dims.height, 'black') : new Jimp(prevFrame);

        const initialX = frame.dims.left;
        const initialY = frame.dims.top;
        let offsetX = initialX;
        let offsetY = initialY;
        let startNewRow = false;

        frame.pixels.forEach((colorIndex, pixelIdx) => {
          if (startNewRow) {
            offsetX = initialX;
            offsetY++;
            startNewRow = false;
          }

          // Look up the pixel RGB value from the color table
          const color = frame.colorTable[colorIndex];
          // Convert the RGB value to HEX
          const hexVal = Jimp.rgbaToInt(color[0], color[1], color[2], 255);

          // If the current pixel is not a transparent pixel,
          // then plot it onto the image canvas.
          if (colorIndex !== frame.transparentIndex) {
            jimpFrame.setPixelColor(hexVal, offsetX, offsetY);
          }

          // If the next pixel is the final pixel of the current row (X),
          // then on next loop we set up our offsets for the next row and reset column (Y) position.
          if (pixelIdx !== 0 && (pixelIdx + 1) % frame.dims.width === 0) {
            startNewRow = true;
          } else {
            // Move to next pixel in the current row.
            offsetX++;
          }
        });

        await Jimp.read(jimpFrame).then(img => {
          img.scaleToFit(width, Jimp.AUTO, Jimp.RESIZE_BEZIER).contrast(0.2);

          let w = img.getWidth(),
            h = img.getHeight();

          const ftImage = new FlaschenTaschenImage({width, height, layer});

          for (let x = 0; x < w; x++) {
            for (let y = 0; y < h; y++) {
              let pixi = Jimp.intToRGBA(img.getPixelColor(x, y));
              ftImage.plot(x, y, {r: pixi.r, g: pixi.g, b: pixi.b});
            }
          }

          processedFrames.push({
            image: ftImage,
            delay: frame.delay,
          });
        });

        // TODO: This part may need to be refactored to support GIFs that do not use disposalType 1
        // see http://www.matthewflickinger.com/lab/whatsinagif/animation_and_transparency.asp
        // Set the previous frame to the current frame image, ready to be patched over with the next frame.
        prevFrame = jimpFrame;
      }

      return processedFrames;
    } catch (error) {
      throw new Error(error as any);
    }
  }

  private async createStaticImage(buffer: Buffer): Promise<FTAnimationFrame[]> {
    try {
      let processedFrames: FTAnimationFrame[] = [];
      await Jimp.read(buffer).then(img => {
        img.scaleToFit(this.width, Jimp.AUTO, Jimp.RESIZE_BEZIER).contrast(0.2);

        let w = img.getWidth(),
          h = img.getHeight();

        const ftImage = new FlaschenTaschenImage({
          width: this.width,
          height: this.height,
          layer: 5,
        });

        for (let x = 0; x < w; x++) {
          for (let y = 0; y < h; y++) {
            let pixi = Jimp.intToRGBA(img.getPixelColor(x, y));
            ftImage.plot(x, y, {r: pixi.r, g: pixi.g, b: pixi.b});
          }
        }
        processedFrames.push({
          image: ftImage,
          delay: 1000,
        });
      });

      return processedFrames;
    } catch (error) {
      throw new Error(error as any);
    }
  }

  /**
   * Decode a GIF to parsed frame objects using gifuct-js
   * @param buffer
   * @returns
   */
  private async decodeGif(buffer: ArrayBuffer): Promise<ParsedFrame[]> {
    const parsedGif = parseGIF(buffer);
    return decompressFrames(parsedGif, true);
  }

  /**
   * Construct and render an animated image frameset ready for `broadcast()`.
   * @param buffer Binary file buffer
   */
  private async renderAnimation(buffer: ArrayBuffer): Promise<void> {
    try {
      const decodedGif = await this.decodeGif(buffer);
      const frames = await this.createAnimation(decodedGif, this.width, this.height);
      this.broadcast(frames);
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Construct and render a static image frame ready for `broadcast()`.
   * @param buffer Binary file buffer
   */
  private async renderStatic(buffer: Buffer): Promise<void> {
    try {
      const frame = await this.createStaticImage(buffer);
      this.broadcast(frame);
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Update this class's `displayTimeout` timer with a new timer that renders the
   * next selected frame.
   * @param frames FT animation frames
   * @param frameIndex The current frame to render.
   */
  private broadcast(frames: FTAnimationFrame[], frameIndex = 0): void {
    this.stop();
    if (!frameIndex) {
      frameIndex = 0;
    }

    const delay = frames[frameIndex].delay;

    this.displayTimeout = setTimeout(() => {
      this.client.render(frames[frameIndex].image);

      if (frameIndex === frames.length - 1 /* && repeat */) {
        frameIndex = 0;
      } else {
        frameIndex++;
      }
      this.broadcast(frames, frameIndex);
    }, delay);
  }
}

/**
 * PPM Image options
 */
export interface ImageOptions {
  // Canvas height
  height?: number;
  // Canvas width
  width?: number;
  // Z-offset
  layer?: number;
  // X-offset
  offsetX?: number;
  // Y-offset
  offsetY?: number;
}

export interface RGBValue {
  r: number;
  g: number;
  b: number;
}

export interface FTAnimationFrame {
  image: FlaschenTaschenImage;
  delay: number;
}
