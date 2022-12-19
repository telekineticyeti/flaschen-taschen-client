# Flaschen-Taschen Node Client

This library includes a number of helper functions that assist in the construction and broadcast of image files in [PPM format](https://netpbm.sourceforge.net/doc/ppm.html) to [Flaschen-Taschen](https://github.com/hzeller/flaschen-taschen) servers.

This library is a **work in progress**, and right now contains the very basic feature of creating a static image in `Buffer` and sending to an [FT server](https://github.com/hzeller/flaschen-taschen/blob/master/doc/protocols.md).

This library is loosely based on [flashenode](https://github.com/mpmckenna8/flashenode). It is written in Typescript.

# Usage

Import the library and instantiate the class with a string parameter containing the target server IP or host.

```ts
import {FlaschenTaschenClient} from './flaschen-taschen.client.class';

const FTC = new FlaschenTaschenClient(
  'SERVER_IP_OR_HOSTNAME', // Your FT server address
  SERVER_PORT, // Number parameter (optional). Fefault is 1337
);

// Create an image

// The `create()` method accepts an optional parameter object.
// This object contains the following options listed below, alongside their default values.
const imageOptions = {
  // PPM Image Dimensions
  width: 32,
  height: 32,
  // On which layer to display the image. FT servers allow the display of
  // several images at once on different layers.
  layer: 15,
  // Horizontal and vertical image offset.
  offsetX: 0,
  offsetY: 0,
};

const image = FTC.create(imageOptions);
```

# Working Example

The example below fetches an online image, uses the [Jimp library](https://www.npmjs.com/package/jimp) to manipulate the image, then plots each pixel's RGB value to the PPM image buffer. The resulting PPM image is then rendered to a remote 64x64 RGB matrix.

```ts
import fetch from 'node-fetch';
import {FlaschenTaschenClient} from './flaschen-taschen.client.class';
import Jimp from 'jimp';

(async () => {
  const FTC = new FlaschenTaschenClient('192.168.0.1');

  const url =
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Front_of_the_Ostrich_Egg_Globe.jpg/1280px-Front_of_the_Ostrich_Egg_Globe.jpg';

  try {
    // node-fetch grabs the image and converts the response to a binary buffer.
    const response = await fetch(url);
    const binaryBuffer = await response.buffer();

    // Create the FT image instance that we will plot our pixels to, and render from.
    const myImage = FTC.create({height: 64, width: 64});

    // Jimp library reads the buffer, scales the image to the target size of 64 pixels, and then reads
    // the output pixel by pixel, plotting to the FT image with the class instance `plot()` method.
    Jimp.read(binaryBuffer).then(img => {
      img.scaleToFit(64, Jimp.AUTO, Jimp.RESIZE_BEZIER);

      let w = img.getWidth(),
        h = img.getHeight();
      let pixelCount = 0;

      // Loop through the image x/y coords
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
          // Retrieve the RGBA value of the pixel at the current coordinate
          let pixel = Jimp.intToRGBA(img.getPixelColor(x, y));

          // Plot the colour value to our FT image class.
          myImage.plot(x, y, {r: pixel.r, g: pixel.g, b: pixel.b});

          // For debug readout.
          pixelCount++;
        }
      }

      console.log(`Sending image ${img.getWidth()}x${img.getHeight()} (${pixelCount} pixels)`);

      // Optional debug step - output the image to file
      myImage.write('./myImage.ppm');

      // Instructs FTC client class to send the image to FT server.
      FTC.render(myImage);
    });
  } catch (error) {
    throw new Error(error as any);
  }
})();
```
