// ── Mesh Warp Module ──
// 网格三角形变形，让纹身贴合身体曲面

window.MeshWarp = (function () {
  'use strict';

  // 解仿射变换矩阵：将源三角形映射到目标三角形
  function solveAffine(sx0, sy0, sx1, sy1, sx2, sy2, dx0, dy0, dx1, dy1, dx2, dy2) {
    // 源三角形矩阵求逆，乘以目标三角形矩阵
    const det = (sx0 - sx2) * (sy1 - sy2) - (sx1 - sx2) * (sy0 - sy2);
    if (Math.abs(det) < 1e-10) return null;

    const a = ((dx0 - dx2) * (sy1 - sy2) - (dx1 - dx2) * (sy0 - sy2)) / det;
    const b = ((dx1 - dx2) * (sx0 - sx2) - (dx0 - dx2) * (sx1 - sx2)) / det;
    const c = ((dy0 - dy2) * (sy1 - sy2) - (dy1 - dy2) * (sy0 - sy2)) / det;
    const d = ((dy1 - dy2) * (sx0 - sx2) - (dy0 - dy2) * (sx1 - sx2)) / det;
    const e = dx2 - a * sx2 - b * sy2;
    const f = dy2 - c * sx2 - d * sy2;

    return [a, c, b, d, e, f]; // setTransform 参数顺序
  }

  // 绘制一个三角形纹理映射
  function drawTriangle(ctx, img, sx0, sy0, sx1, sy1, sx2, sy2, dx0, dy0, dx1, dy1, dx2, dy2) {
    const affine = solveAffine(sx0, sy0, sx1, sy1, sx2, sy2, dx0, dy0, dx1, dy1, dx2, dy2);
    if (!affine) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(dx0, dy0);
    ctx.lineTo(dx1, dy1);
    ctx.lineTo(dx2, dy2);
    ctx.closePath();
    ctx.clip();

    ctx.setTransform(affine[0], affine[1], affine[2], affine[3], affine[4], affine[5]);
    ctx.drawImage(img, 0, 0);

    ctx.restore();
  }

  // 网格变形渲染
  // tattooImg: 纹身 canvas/image
  // controlPoints: 2D 数组 [row][col] = {x, y}，目标坐标（画布空间）
  // gridCols, gridRows: 网格大小
  function renderWarped(ctx, tattooImg, controlPoints, gridCols, gridRows, alpha, compositeOp) {
    const srcW = tattooImg.width / gridCols;
    const srcH = tattooImg.height / gridRows;

    ctx.save();
    ctx.globalAlpha = alpha || 1;
    if (compositeOp) ctx.globalCompositeOperation = compositeOp;

    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const p0 = controlPoints[row][col];         // 左上
        const p1 = controlPoints[row][col + 1];     // 右上
        const p2 = controlPoints[row + 1][col + 1]; // 右下
        const p3 = controlPoints[row + 1][col];     // 左下

        const sx = col * srcW;
        const sy = row * srcH;

        // 三角形1: 左上-右上-左下
        drawTriangle(ctx, tattooImg,
          sx, sy, sx + srcW, sy, sx, sy + srcH,
          p0.x, p0.y, p1.x, p1.y, p3.x, p3.y
        );

        // 三角形2: 右上-右下-左下
        drawTriangle(ctx, tattooImg,
          sx + srcW, sy, sx + srcW, sy + srcH, sx, sy + srcH,
          p1.x, p1.y, p2.x, p2.y, p3.x, p3.y
        );
      }
    }

    ctx.restore();
  }

  return {
    renderWarped,
    drawTriangle,
    solveAffine
  };
})();
