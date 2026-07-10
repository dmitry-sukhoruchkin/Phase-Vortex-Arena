import { COORDS_16_X, COORDS_16_Y } from '../config';

export const dX = new Float32Array(16 * 16);
export const dY = new Float32Array(16 * 16);
export const dTQ = new Float32Array(16 * 16);

let maxTQ = 0;
for (let i = 0; i < 16; i++) {
  for (let j = 0; j < 16; j++) {
    dX[i * 16 + j] = COORDS_16_X[i] - COORDS_16_X[j];
    dY[i * 16 + j] = COORDS_16_Y[i] - COORDS_16_Y[j];
    const tq = COORDS_16_X[i] * COORDS_16_Y[j] - COORDS_16_Y[i] * COORDS_16_X[j];
    dTQ[i * 16 + j] = tq;
    if (Math.abs(tq) > maxTQ) maxTQ = Math.abs(tq);
  }
}

for (let i = 0; i < 16 * 16; i++) {
  dTQ[i] /= (maxTQ + 1e-8);
}
