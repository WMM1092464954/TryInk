// ── Body Models Module ──
// 预设身体曲面模型，生成网格变形控制点

window.BodyModels = (function () {
  'use strict';

  var GRID_COLS = 6;
  var GRID_ROWS = 6;

  // 生成平面网格（无变形）
  function flatGrid(t) {
    var points = [];
    for (var row = 0; row <= GRID_ROWS; row++) {
      points[row] = [];
      for (var col = 0; col <= GRID_COLS; col++) {
        var u = col / GRID_COLS;
        var v = row / GRID_ROWS;
        points[row][col] = {
          x: t.x - t.size / 2 + u * t.size,
          y: t.y - t.size / 2 + v * t.size
        };
      }
    }
    return points;
  }

  // 圆柱体变形（手臂/腿 - 水平弯曲）
  function cylinderH(t, curvature) {
    var points = [];
    var c = curvature / 100; // 0~1
    for (var row = 0; row <= GRID_ROWS; row++) {
      points[row] = [];
      for (var col = 0; col <= GRID_COLS; col++) {
        var u = col / GRID_COLS;       // 0~1 水平
        var v = row / GRID_ROWS;       // 0~1 垂直

        // 正弦曲线模拟圆柱体投影
        var angle = (u - 0.5) * Math.PI * c;
        var xScale = c > 0.01 ? Math.sin(angle) / (Math.PI * c * 0.5) + 0.5 : u;
        // 边缘垂直方向略有收缩
        var yScale = 1.0 - c * 0.08 * (1 - Math.cos(angle));
        // 边缘处水平压缩（透视感）
        var squeeze = 1.0 - c * 0.15 * Math.pow(Math.abs(u - 0.5) * 2, 2);

        var px = t.x - t.size / 2 + xScale * t.size * squeeze;
        var baseY = t.y - t.size / 2;
        var py = baseY + (t.size * yScale) * v + (1 - yScale) * t.size * 0.5 * (v - 0.5);

        points[row][col] = { x: px, y: py };
      }
    }
    return points;
  }

  // 圆柱体变形（躯干 - 垂直弯曲）
  function cylinderV(t, curvature) {
    var points = [];
    var c = curvature / 100;
    for (var row = 0; row <= GRID_ROWS; row++) {
      points[row] = [];
      for (var col = 0; col <= GRID_COLS; col++) {
        var u = col / GRID_COLS;
        var v = row / GRID_ROWS;

        var angle = (v - 0.5) * Math.PI * c;
        var yScale = c > 0.01 ? Math.sin(angle) / (Math.PI * c * 0.5) + 0.5 : v;
        var xShrink = 1.0 - c * 0.08 * (1 - Math.cos(angle));
        var squeeze = 1.0 - c * 0.15 * Math.pow(Math.abs(v - 0.5) * 2, 2);

        var baseX = t.x - t.size / 2;
        var px = baseX + (t.size * xShrink) * u + (1 - xShrink) * t.size * 0.5 * (u - 0.5);
        var py = t.y - t.size / 2 + yScale * t.size * squeeze;

        points[row][col] = { x: px, y: py };
      }
    }
    return points;
  }

  // 球面变形（肩膀/膝盖）
  function sphere(t, curvature) {
    var points = [];
    var c = curvature / 100;
    for (var row = 0; row <= GRID_ROWS; row++) {
      points[row] = [];
      for (var col = 0; col <= GRID_COLS; col++) {
        var u = col / GRID_COLS;
        var v = row / GRID_ROWS;

        // 从中心到边缘的距离
        var du = (u - 0.5) * 2; // -1~1
        var dv = (v - 0.5) * 2;
        var dist = Math.sqrt(du * du + dv * dv);

        // 球面投影：边缘向中心收缩
        var scale = 1.0 - c * 0.2 * dist * dist;
        // 边缘透视压缩
        var perspX = 0.5 + (u - 0.5) * scale;
        var perspY = 0.5 + (v - 0.5) * scale;

        points[row][col] = {
          x: t.x - t.size / 2 + perspX * t.size,
          y: t.y - t.size / 2 + perspY * t.size
        };
      }
    }
    return points;
  }

  // 根据类型生成控制点
  function generateControlPoints(t, surface, curvature) {
    switch (surface) {
      case 'cylinder-h': return cylinderH(t, curvature);
      case 'cylinder-v': return cylinderV(t, curvature);
      case 'sphere':     return sphere(t, curvature);
      default:           return flatGrid(t);
    }
  }

  return {
    generateControlPoints: generateControlPoints,
    GRID_COLS: GRID_COLS,
    GRID_ROWS: GRID_ROWS
  };
})();
