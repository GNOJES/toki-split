import { shapePath, strokePath } from "./paths.js";
import { partitionMask } from "./geometry.js";
export const RES = 560;
export function createCutter() {
  let currentPoly;
  const PIXELS = RES * RES;
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = RES;
  maskCanvas.height = RES;
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
  const baseMask = new Uint8Array(PIXELS);

  let baseArea = 0;
  function prepareShape(poly) {
    maskCtx.clearRect(0, 0, RES, RES);
    shapePath(maskCtx, poly, RES);
    maskCtx.fillStyle = "#fff";
    maskCtx.fill();
    const pixels = maskCtx.getImageData(0, 0, RES, RES).data;
    baseArea = 0;
    for (let i = 0; i < PIXELS; i++) {
      const present = pixels[i * 4 + 3] >= 128 ? 1 : 0;
      baseMask[i] = present;
      baseArea += present;
    }
  }
  function findPieces(strokes) {
    maskCtx.clearRect(0, 0, RES, RES);
    shapePath(maskCtx, currentPoly, RES);
    maskCtx.fillStyle = "#fff";
    maskCtx.fill();
    if (strokes.length) {
      maskCtx.save();
      maskCtx.globalCompositeOperation = "destination-out";
      maskCtx.strokeStyle = "#fff";
      maskCtx.lineWidth = 3.2;
      maskCtx.lineCap = "round";
      maskCtx.lineJoin = "round";
      for (const points of strokes) {
        strokePath(maskCtx, points, RES);
        maskCtx.stroke();
      }
      maskCtx.restore();
    }
    const rgba = maskCtx.getImageData(0, 0, RES, RES).data;
    const remainingMask = new Uint8Array(PIXELS);
    for (let i = 0; i < PIXELS; i++)
      remainingMask[i] = rgba[i * 4 + 3] >= 128 ? 1 : 0;
    return partitionMask(baseMask, remainingMask, RES);
  }
  return {
    prepare(poly) {
      currentPoly = poly;
      prepareShape(poly);
    },
    findPieces,
    get baseArea() {
      return baseArea;
    },
  };
}
