import dgram from 'dgram';
import fs from 'fs';

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
  public create(options?: ImageOptions) {
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
    fs.writeFile(path, this.buffer, error => {
      if (error) {
        throw new Error(error as any);
      }
    });
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
