"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.FlaschenTaschenPlayer = exports.FlaschenTaschenImage = exports.FlaschenTaschenClient = void 0;
var dgram_1 = require("dgram");
var promises_1 = require("fs/promises");
var gifuct_js_1 = require("gifuct-js");
var jimp_1 = require("jimp");
var node_fetch_1 = require("node-fetch");
var path_1 = require("path");
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
var FlaschenTaschenClient = /** @class */ (function () {
    function FlaschenTaschenClient(host, port) {
        this.host = host;
        this.port = 1337;
        this.defaultImageOptions = {
            width: 32,
            height: 32,
            layer: 15,
            offsetX: 0,
            offsetY: 0
        };
        // Suppress debug messages
        this.silent = true;
        if (port)
            this.port = port;
    }
    /**
     * Creates and returns a Flaschen Taschen Image class instance.
     * This instance contains the immage binary buffer, in addition to
     * several helper methods for image manipulation.
     */
    FlaschenTaschenClient.prototype.create = function (options) {
        var mergedOptions = __assign(__assign({}, this.defaultImageOptions), options);
        return new FlaschenTaschenImage(mergedOptions);
    };
    /**
     * Accetps a FlaschenTaschenImage instance, and transmits the
     * instance buffer to the target host.
     */
    FlaschenTaschenClient.prototype.render = function (ftImage) {
        var _this = this;
        var client = dgram_1["default"].createSocket('udp4');
        client.send(ftImage.buffer, this.port, this.host, function (error, bytes) {
            if (error)
                throw error;
            if (!_this.silent) {
                console.log("UDP message sent to ".concat(_this.host, ":").concat(_this.port, " (").concat(bytes, " bytes)"));
            }
            client.close();
        });
    };
    FlaschenTaschenClient.prototype.createPlayer = function (width, height) {
        if (width === void 0) { width = 32; }
        if (height === void 0) { height = 32; }
        return new FlaschenTaschenPlayer(this, width, height);
    };
    return FlaschenTaschenClient;
}());
exports.FlaschenTaschenClient = FlaschenTaschenClient;
/**
 * FT Image Class
 * Creates a binary buffer in PPM image format with FT specific headers.
 * Use the `plot()` method to draw pixels to the image, or the write method
 * to output the buffer to a file in ppm format.
 */
var FlaschenTaschenImage = /** @class */ (function () {
    function FlaschenTaschenImage(options) {
        this.ppmFileType = 'P6';
        this.init(options);
    }
    /**
     * Initialises the PPM binary buffer.
     * Use @link plot() to draw pixels.
     */
    FlaschenTaschenImage.prototype.init = function (options) {
        // PPM header packet string
        this.header = "".concat(this.ppmFileType, "\n").concat(options.width, " ").concat(options.height, "\n#FT: ").concat(options.offsetX, " ").concat(options.offsetY, " ").concat(options.layer, "\n255\n");
        // PPM footer packet string
        var footer = "";
        this.width = options.width;
        this.height = options.height;
        this.buffer = Buffer.alloc(this.header.length + footer.length + options.height * options.width * 3);
        this.buffer.write(this.header);
        var start = this.buffer.length - footer.length;
        this.buffer.write(footer, start);
    };
    /**
     * Plot a pixel value in the PPM at the specified coordinates.
     * @param x x coordinate
     * @param y y coordinate
     * @param colour RGB value { r, g, b }
     */
    FlaschenTaschenImage.prototype.plot = function (x, y, colour) {
        // Calculate the byte offset in image binary to make adjustments
        var offset = (x + y * this.width) * 3 + this.header.length;
        this.buffer[offset] = colour.r;
        this.buffer[offset + 1] = colour.g;
        this.buffer[offset + 2] = colour.b;
    };
    /**
     * Write the PPM buffer to file
     * @param path Output Path/filename. Example `./image.ppm`
     */
    FlaschenTaschenImage.prototype.write = function (path) {
        promises_1["default"].writeFile(path, this.buffer);
    };
    /**
     * Wipes the current image by setting every pixel to black.
     */
    FlaschenTaschenImage.prototype.clear = function () {
        for (var x = 0; x < this.width; x++) {
            for (var y = 0; y < this.height; y++) {
                this.plot(x, y, { r: 0, g: 0, b: 0 });
            }
        }
    };
    return FlaschenTaschenImage;
}());
exports.FlaschenTaschenImage = FlaschenTaschenImage;
/**
 * Contains helper methods for continuously broadcasting static or animated images
 * to a Flaschen-taschen client
 */
var FlaschenTaschenPlayer = /** @class */ (function () {
    function FlaschenTaschenPlayer(client, width, height) {
        this.client = client;
        this.width = width;
        this.height = height;
    }
    /**
     * Play (broadcast) the image to Flaschen-taschen client
     * @param location URL or file path string.
     */
    FlaschenTaschenPlayer.prototype.play = function (location) {
        return __awaiter(this, void 0, void 0, function () {
            var response, contentType, buffer, buffer, file, fileExt, buffer, buffer, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 9, , 10]);
                        if (!this.isUrl(location)) return [3 /*break*/, 6];
                        return [4 /*yield*/, (0, node_fetch_1["default"])(location)];
                    case 1:
                        response = _a.sent();
                        contentType = response.headers.get('content-type');
                        if (!(contentType === 'image/gif')) return [3 /*break*/, 3];
                        return [4 /*yield*/, response.arrayBuffer()];
                    case 2:
                        buffer = _a.sent();
                        this.renderAnimation(buffer);
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, response.buffer()];
                    case 4:
                        buffer = _a.sent();
                        this.renderStatic(buffer);
                        _a.label = 5;
                    case 5: return [3 /*break*/, 8];
                    case 6: return [4 /*yield*/, promises_1["default"].readFile(location)];
                    case 7:
                        file = _a.sent();
                        fileExt = path_1["default"].extname(location);
                        if (fileExt.toLowerCase().includes('gif')) {
                            buffer = file.buffer;
                            this.renderAnimation(buffer);
                        }
                        else {
                            buffer = file;
                            this.renderStatic(buffer);
                        }
                        _a.label = 8;
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        error_1 = _a.sent();
                        console.error(error_1);
                        return [3 /*break*/, 10];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    FlaschenTaschenPlayer.prototype.stop = function () {
        clearTimeout(this.displayTimeout);
    };
    /**
     * Simple method to attempt to detect if provided string is URL.
     */
    FlaschenTaschenPlayer.prototype.isUrl = function (str) {
        try {
            new URL(str);
            return true;
        }
        catch (err) {
            return false;
        }
    };
    /**
     * Converts ParsedFrames from gifuct-js to Flaschen-taschen compatible PPM files,
     * in addition to performing any required post-processing such as resize or contrasting.
     * @param frames gifuct ParsedFrame array.
     * @returns Array of objects containing PPM binary buffers and frame delay values.
     */
    FlaschenTaschenPlayer.prototype.createAnimation = function (frames, width, height, layer) {
        if (width === void 0) { width = 32; }
        if (height === void 0) { height = 32; }
        if (layer === void 0) { layer = 5; }
        return __awaiter(this, void 0, void 0, function () {
            var prevFrame, processedFrames_1, _loop_1, _i, frames_1, frame, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        if (!frames.length) {
                            throw new Error('no frames to process');
                        }
                        prevFrame = void 0;
                        processedFrames_1 = [];
                        _loop_1 = function (frame) {
                            var jimpFrame, initialX, initialY, offsetX, offsetY, startNewRow;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        jimpFrame = !prevFrame ? new jimp_1["default"](frame.dims.width, frame.dims.height, 'black') : new jimp_1["default"](prevFrame);
                                        initialX = frame.dims.left;
                                        initialY = frame.dims.top;
                                        offsetX = initialX;
                                        offsetY = initialY;
                                        startNewRow = false;
                                        frame.pixels.forEach(function (colorIndex, pixelIdx) {
                                            if (startNewRow) {
                                                offsetX = initialX;
                                                offsetY++;
                                                startNewRow = false;
                                            }
                                            // Look up the pixel RGB value from the color table
                                            var color = frame.colorTable[colorIndex];
                                            // Convert the RGB value to HEX
                                            var hexVal = jimp_1["default"].rgbaToInt(color[0], color[1], color[2], 255);
                                            // If the current pixel is not a transparent pixel,
                                            // then plot it onto the image canvas.
                                            if (colorIndex !== frame.transparentIndex) {
                                                jimpFrame.setPixelColor(hexVal, offsetX, offsetY);
                                            }
                                            // If the next pixel is the final pixel of the current row (X),
                                            // then on next loop we set up our offsets for the next row and reset column (Y) position.
                                            if (pixelIdx !== 0 && (pixelIdx + 1) % frame.dims.width === 0) {
                                                startNewRow = true;
                                            }
                                            else {
                                                // Move to next pixel in the current row.
                                                offsetX++;
                                            }
                                        });
                                        return [4 /*yield*/, jimp_1["default"].read(jimpFrame).then(function (img) {
                                                img.scaleToFit(width, jimp_1["default"].AUTO, jimp_1["default"].RESIZE_BEZIER).contrast(0.2);
                                                var w = img.getWidth(), h = img.getHeight();
                                                var ftImage = new FlaschenTaschenImage({ width: width, height: height, layer: layer });
                                                for (var x = 0; x < w; x++) {
                                                    for (var y = 0; y < h; y++) {
                                                        var pixi = jimp_1["default"].intToRGBA(img.getPixelColor(x, y));
                                                        ftImage.plot(x, y, { r: pixi.r, g: pixi.g, b: pixi.b });
                                                    }
                                                }
                                                processedFrames_1.push({
                                                    image: ftImage,
                                                    delay: frame.delay
                                                });
                                            })];
                                    case 1:
                                        _b.sent();
                                        // TODO: This part may need to be refactored to support GIFs that do not use disposalType 1
                                        // see http://www.matthewflickinger.com/lab/whatsinagif/animation_and_transparency.asp
                                        // Set the previous frame to the current frame image, ready to be patched over with the next frame.
                                        prevFrame = jimpFrame;
                                        return [2 /*return*/];
                                }
                            });
                        };
                        _i = 0, frames_1 = frames;
                        _a.label = 1;
                    case 1:
                        if (!(_i < frames_1.length)) return [3 /*break*/, 4];
                        frame = frames_1[_i];
                        return [5 /*yield**/, _loop_1(frame)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, processedFrames_1];
                    case 5:
                        error_2 = _a.sent();
                        throw new Error(error_2);
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    FlaschenTaschenPlayer.prototype.createStaticImage = function (buffer) {
        return __awaiter(this, void 0, void 0, function () {
            var processedFrames_2, error_3;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        processedFrames_2 = [];
                        return [4 /*yield*/, jimp_1["default"].read(buffer).then(function (img) {
                                img.scaleToFit(_this.width, jimp_1["default"].AUTO, jimp_1["default"].RESIZE_BEZIER).contrast(0.2);
                                var w = img.getWidth(), h = img.getHeight();
                                var ftImage = new FlaschenTaschenImage({
                                    width: _this.width,
                                    height: _this.height,
                                    layer: 5
                                });
                                for (var x = 0; x < w; x++) {
                                    for (var y = 0; y < h; y++) {
                                        var pixi = jimp_1["default"].intToRGBA(img.getPixelColor(x, y));
                                        ftImage.plot(x, y, { r: pixi.r, g: pixi.g, b: pixi.b });
                                    }
                                }
                                processedFrames_2.push({
                                    image: ftImage,
                                    delay: 1000
                                });
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, processedFrames_2];
                    case 2:
                        error_3 = _a.sent();
                        throw new Error(error_3);
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Decode a GIF to parsed frame objects using gifuct-js
     * @param buffer
     * @returns
     */
    FlaschenTaschenPlayer.prototype.decodeGif = function (buffer) {
        return __awaiter(this, void 0, void 0, function () {
            var parsedGif;
            return __generator(this, function (_a) {
                parsedGif = (0, gifuct_js_1.parseGIF)(buffer);
                return [2 /*return*/, (0, gifuct_js_1.decompressFrames)(parsedGif, true)];
            });
        });
    };
    /**
     * Construct and render an animated image frameset ready for `broadcast()`.
     * @param buffer Binary file buffer
     */
    FlaschenTaschenPlayer.prototype.renderAnimation = function (buffer) {
        return __awaiter(this, void 0, void 0, function () {
            var decodedGif, frames_2, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.decodeGif(buffer)];
                    case 1:
                        decodedGif = _a.sent();
                        return [4 /*yield*/, this.createAnimation(decodedGif, this.width, this.height)];
                    case 2:
                        frames_2 = _a.sent();
                        this.broadcast(frames_2);
                        return [3 /*break*/, 4];
                    case 3:
                        error_4 = _a.sent();
                        console.error(error_4);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Construct and render a static image frame ready for `broadcast()`.
     * @param buffer Binary file buffer
     */
    FlaschenTaschenPlayer.prototype.renderStatic = function (buffer) {
        return __awaiter(this, void 0, void 0, function () {
            var frame, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.createStaticImage(buffer)];
                    case 1:
                        frame = _a.sent();
                        this.broadcast(frame);
                        return [3 /*break*/, 3];
                    case 2:
                        error_5 = _a.sent();
                        console.error(error_5);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update this class's `displayTimeout` timer with a new timer that renders the
     * next selected frame.
     * @param frames FT animation frames
     * @param frameIndex The current frame to render.
     */
    FlaschenTaschenPlayer.prototype.broadcast = function (frames, frameIndex) {
        var _this = this;
        if (frameIndex === void 0) { frameIndex = 0; }
        this.stop();
        if (!frameIndex) {
            frameIndex = 0;
        }
        var delay = frames[frameIndex].delay;
        this.displayTimeout = setTimeout(function () {
            _this.client.render(frames[frameIndex].image);
            if (frameIndex === frames.length - 1 /* && repeat */) {
                frameIndex = 0;
            }
            else {
                frameIndex++;
            }
            _this.broadcast(frames, frameIndex);
        }, delay);
    };
    return FlaschenTaschenPlayer;
}());
exports.FlaschenTaschenPlayer = FlaschenTaschenPlayer;
