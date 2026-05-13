import type { TreeEvent } from "./types";

interface Branch {
  id: string;
  startHeight: number;
  side: -1 | 1;
  angle: number;
  length: number;
  thickness: number;
  growth: number;
  targetGrowth: number;
  label: string;
  hue: number;
  kind: "branch" | "shift";
}

export class TreeCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationId = 0;
  private trunkHeight = 70;
  private targetTrunkHeight = 96;
  private cameraY = 0;
  private targetCameraY = 0;
  private branches: Branch[] = [];
  private lastEventLabel = "等待文字";
  private lastFrame = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D is unavailable");
    }
    this.canvas = canvas;
    this.ctx = ctx;
    this.resize();
    window.addEventListener("resize", this.resize);
    this.tick = this.tick.bind(this);
    this.animationId = requestAnimationFrame(this.tick);
  }

  destroy(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener("resize", this.resize);
  }

  reset(): void {
    this.trunkHeight = 70;
    this.targetTrunkHeight = 96;
    this.cameraY = 0;
    this.targetCameraY = 0;
    this.branches = [];
    this.lastEventLabel = "重新开始";
  }

  applyEvent(event: TreeEvent): void {
    this.lastEventLabel = event.label;
    if (event.type === "grow_branch") {
      this.addBranch(event, "branch");
      this.growTrunk(12 + event.intensity * 10);
      return;
    }
    if (event.type === "shift_branch") {
      this.addBranch(event, "shift");
      this.growTrunk(20 + event.intensity * 16);
      return;
    }
    if (event.type === "return_to_trunk") {
      this.growTrunk(34 + event.intensity * 24);
      return;
    }
    if (event.type === "uncertain") {
      this.growTrunk(8);
      return;
    }
    this.growTrunk(28 + event.intensity * 28);
  }

  private growTrunk(amount: number): void {
    this.targetTrunkHeight += amount;
  }

  private addBranch(event: TreeEvent, kind: Branch["kind"]): void {
    const side: -1 | 1 = this.branches.length % 2 === 0 ? 1 : -1;
    const startHeight = Math.max(44, this.trunkHeight - 20 + Math.random() * 38);
    this.branches.push({
      id: crypto.randomUUID(),
      startHeight,
      side,
      angle: (kind === "shift" ? 0.72 : 0.46 + event.intensity * 0.44) * side,
      length: (kind === "shift" ? 104 : 70) + event.intensity * 120,
      thickness: 2 + event.intensity * (kind === "shift" ? 6 : 5),
      growth: 0,
      targetGrowth: 1,
      label: event.label,
      hue: kind === "shift" ? 66 + Math.floor(Math.random() * 34) : 110 + Math.floor(Math.random() * 62),
      kind
    });
  }

  private resize = (): void => {
    const rect = this.canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.floor(rect.width * scale));
    this.canvas.height = Math.max(1, Math.floor(rect.height * scale));
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
  };

  private tick(now: number): void {
    const delta = Math.min(48, now - this.lastFrame) / 1000;
    this.lastFrame = now;
    this.trunkHeight += (this.targetTrunkHeight - this.trunkHeight) * Math.min(1, delta * 3.5);
    const viewportHeight = this.canvas.clientHeight;
    this.targetCameraY = Math.max(0, this.trunkHeight - viewportHeight * 0.64);
    this.cameraY += (this.targetCameraY - this.cameraY) * Math.min(1, delta * 2.6);
    this.branches.forEach((branch) => {
      branch.growth += (branch.targetGrowth - branch.growth) * Math.min(1, delta * 4.2);
    });
    this.draw();
    this.animationId = requestAnimationFrame(this.tick);
  }

  private draw(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.ctx.clearRect(0, 0, width, height);
    this.drawBackground(width, height);

    const baseX = width * 0.5;
    const baseY = height - 58 + this.cameraY;
    const topY = baseY - this.trunkHeight;

    this.drawGround(baseX, baseY, width);
    this.drawTrunk(baseX, baseY);
    this.branches.forEach((branch) => this.drawBranch(branch, baseX, baseY));
    this.drawCrownHint(baseX, topY);
    this.drawLabel(width);
  }

  private drawBackground(width: number, height: number): void {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#f6f7f1");
    gradient.addColorStop(1, "#e8edde");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);
  }

  private drawGround(baseX: number, baseY: number, width: number): void {
    if (baseY > this.canvas.clientHeight + 40) {
      return;
    }
    this.ctx.strokeStyle = "rgba(77, 91, 62, 0.25)";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(Math.max(20, baseX - width * 0.28), baseY + 3);
    this.ctx.quadraticCurveTo(baseX, baseY + 18, Math.min(width - 20, baseX + width * 0.28), baseY + 3);
    this.ctx.stroke();
  }

  private drawTrunk(baseX: number, baseY: number): void {
    const segments = Math.max(12, Math.ceil(this.trunkHeight / 26));
    this.ctx.lineCap = "round";
    for (let index = 0; index < segments; index += 1) {
      const start = index / segments;
      const end = (index + 1) / segments;
      const y1 = baseY - this.trunkHeight * start;
      const y2 = baseY - this.trunkHeight * end;
      if (y1 < -80 || y2 > this.canvas.clientHeight + 80) {
        continue;
      }
      const sway1 = Math.sin(start * 4.8) * 8 * start;
      const sway2 = Math.sin(end * 4.8) * 8 * end;
      this.ctx.strokeStyle = "#5d4632";
      this.ctx.lineWidth = Math.max(5, 16 * (1 - start * 0.75));
      this.ctx.beginPath();
      this.ctx.moveTo(baseX + sway1, y1);
      this.ctx.lineTo(baseX + sway2, y2);
      this.ctx.stroke();
    }
  }

  private drawBranch(branch: Branch, baseX: number, baseY: number): void {
    const progress = Math.min(1, branch.startHeight / Math.max(1, this.trunkHeight));
    const startY = baseY - branch.startHeight;
    if (startY < -160 || startY > this.canvas.clientHeight + 160) {
      return;
    }
    const startX = baseX + Math.sin(progress * 4.8) * 8 * progress;
    const length = branch.length * branch.growth;
    const endX = startX + Math.sin(branch.angle) * length;
    const endY = startY - Math.cos(branch.angle) * length * 0.72;
    const controlX = startX + (endX - startX) * 0.45 + branch.side * 18;
    const controlY = startY + (endY - startY) * 0.42 - 16;

    this.ctx.lineCap = "round";
    this.ctx.strokeStyle = branch.kind === "shift" ? "#7a6330" : "#654b35";
    this.ctx.lineWidth = branch.thickness;
    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.quadraticCurveTo(controlX, controlY, endX, endY);
    this.ctx.stroke();

    this.ctx.fillStyle = `hsla(${branch.hue}, ${branch.kind === "shift" ? 44 : 38}%, 42%, ${0.25 + branch.growth * 0.45})`;
    for (let index = 0; index < 3; index += 1) {
      const offset = index - 1;
      this.ctx.beginPath();
      this.ctx.ellipse(endX + offset * 9, endY - Math.abs(offset) * 3, 7, 11, branch.angle, 0, Math.PI * 2);
      this.ctx.fill();
    }

    if (branch.growth > 0.82) {
      this.ctx.font = "12px Inter, system-ui, sans-serif";
      this.ctx.fillStyle = "rgba(52, 63, 43, 0.72)";
      this.ctx.textAlign = branch.side === 1 ? "left" : "right";
      this.ctx.fillText(branch.label, endX + branch.side * 12, endY - 8);
    }
  }

  private drawCrownHint(baseX: number, topY: number): void {
    if (topY < -60 || topY > this.canvas.clientHeight + 60) {
      return;
    }
    this.ctx.fillStyle = "rgba(85, 130, 69, 0.18)";
    this.ctx.beginPath();
    this.ctx.ellipse(baseX + 8, topY - 10, 24, 18, -0.2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawLabel(width: number): void {
    this.ctx.font = "14px Inter, system-ui, sans-serif";
    this.ctx.fillStyle = "rgba(39, 49, 33, 0.72)";
    this.ctx.textAlign = "center";
    this.ctx.fillText(this.lastEventLabel, width / 2, 34);
  }
}
