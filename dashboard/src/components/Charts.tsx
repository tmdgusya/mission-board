import React, { useRef, useEffect, useCallback } from "react";

// =============================================
// Types
// =============================================

interface DonutChartData {
  label: string;
  value: number;
  color: string;
}

interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

interface LineChartData {
  data: { date: string; count: number }[];
}

interface ChartContainerProps {
  title: string;
  testId: string;
  children: React.ReactNode;
  width?: string;
}

// =============================================
// Color Palette
// =============================================

const CHART_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#a855f7", // purple
  "#ef4444", // red
  "#64748b", // slate
  "#06b6d4", // cyan
  "#ec4899", // pink
];

const STATUS_CHART_COLORS: Record<string, string> = {
  backlog: "#64748b",
  ready: "#3b82f6",
  in_progress: "#f59e0b",
  review: "#a855f7",
  done: "#22c55e",
  blocked: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  ready: "Ready",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
  blocked: "Blocked",
};

// =============================================
// Canvas Helper
// =============================================

function useCanvasRenderer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafId = useRef<number>(0);

  const setupCanvas = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return null;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
    return { ctx, width, height };
  }, []);

  const scheduleRender = useCallback(
    (renderFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) => {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        const result = setupCanvas();
        if (result?.ctx) {
          renderFn(result.ctx, result.width, result.height);
        }
      });
    },
    [setupCanvas]
  );

  useEffect(() => {
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  return { containerRef, canvasRef, scheduleRender };
}

// =============================================
// Chart Container
// =============================================

function ChartContainer({
  title,
  testId,
  children,
  width = "100%",
}: ChartContainerProps): React.ReactElement {
  return (
    <div
      data-testid={testId}
      style={{
        backgroundColor: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "10px",
        padding: "20px",
        width,
        minWidth: "0",
      }}
    >
      <h3
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "#cbd5e1",
          margin: "0 0 16px 0",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

// =============================================
// Donut Chart
// =============================================

interface DonutChartProps {
  data: DonutChartData[];
  testId?: string;
  size?: number;
}

export function DonutChart({
  data,
  testId = "donut-chart",
  size = 240,
}: DonutChartProps): React.ReactElement {
  const { containerRef, canvasRef, scheduleRender } = useCanvasRenderer();
  const total = data.reduce((sum, d) => sum + d.value, 0);

  useEffect(() => {
    const render = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.clearRect(0, 0, w, h);

      const centerX = w / 2;
      const centerY = h / 2;
      const outerRadius = Math.max(1, Math.min(w, h) / 2 - 20);
      const innerRadius = Math.max(1, outerRadius * 0.6);

      if (total === 0) {
        // Empty state ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
        ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2, true);
        ctx.fillStyle = "#1e293b";
        ctx.fill();

        ctx.fillStyle = "#64748b";
        ctx.font = "14px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("No data", centerX, centerY);
        return;
      }

      let startAngle = -Math.PI / 2;

      for (const segment of data) {
        if (segment.value === 0) continue;
        const sliceAngle = (segment.value / total) * Math.PI * 2;

        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + sliceAngle);
        ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = segment.color;
        ctx.fill();

        // Thin separator line
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + sliceAngle);
        ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
        ctx.closePath();
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 2;
        ctx.stroke();

        startAngle += sliceAngle;
      }

      // Center text
      ctx.fillStyle = "#f1f5f9";
      ctx.font = "bold 28px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(total), centerX, centerY - 8);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px -apple-system, sans-serif";
      ctx.fillText("Total", centerX, centerY + 14);
    };

    scheduleRender(render);
  }, [data, total, scheduleRender]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const render = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        ctx.clearRect(0, 0, w, h);
        // Re-render on resize will be triggered by the main effect
      };
      scheduleRender(render);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [scheduleRender]);

  const legendItems = data.filter((d) => d.value > 0);

  return (
    <div data-testid={testId} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
      <div
        ref={containerRef}
        style={{ width: `${size}px`, height: `${size}px`, position: "relative" }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
          }}
          aria-label="Donut chart showing task status distribution"
          role="img"
        />
      </div>
      {legendItems.length > 0 && (
        <div
          data-testid={`${testId}-legend`}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            justifyContent: "center",
          }}
        >
          {legendItems.map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                color: "#cbd5e1",
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "2px",
                  backgroundColor: item.color,
                }}
              />
              <span>{item.label}</span>
              <span style={{ color: "#94a3b8", fontWeight: 600 }}>{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================
// Bar Chart (Agent Comparison)
// =============================================

interface BarChartProps {
  data: BarChartData[];
  testId?: string;
}

export function BarChart({
  data,
  testId = "bar-chart",
}: BarChartProps): React.ReactElement {
  const { containerRef, canvasRef, scheduleRender } = useCanvasRenderer();
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  useEffect(() => {
    const render = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.clearRect(0, 0, w, h);

      if (data.length === 0) {
        ctx.fillStyle = "#64748b";
        ctx.font = "14px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("No data", w / 2, h / 2);
        return;
      }

      const paddingLeft = 12;
      const paddingRight = 12;
      const paddingTop = 8;
      const paddingBottom = 50;
      const chartWidth = w - paddingLeft - paddingRight;
      const chartHeight = h - paddingTop - paddingBottom;

      const barGroupWidth = chartWidth / data.length;
      const barWidth = Math.max(4, Math.min(barGroupWidth * 0.6, 60));
      const barGap = (barGroupWidth - barWidth) / 2;

      // Draw grid lines
      const gridLines = 5;
      for (let i = 0; i <= gridLines; i++) {
        const y = paddingTop + (chartHeight / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(w - paddingRight, y);
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw bars
      data.forEach((item, index) => {
        const barHeight = maxValue > 0 ? (item.value / maxValue) * chartHeight : 0;
        const x = paddingLeft + index * barGroupWidth + barGap;
        const y = paddingTop + chartHeight - barHeight;
        const color = item.color || CHART_COLORS[index % CHART_COLORS.length];

        // Bar with rounded top
        const radius = Math.min(4, barWidth / 2, barHeight / 2);
        ctx.beginPath();
        if (barHeight > radius * 2) {
          ctx.moveTo(x, y + radius);
          ctx.arcTo(x, y, x + radius, y, radius);
          ctx.arcTo(x + barWidth, y, x + barWidth, y + radius, radius);
          ctx.lineTo(x + barWidth, paddingTop + chartHeight);
          ctx.lineTo(x, paddingTop + chartHeight);
        } else if (barHeight > 0) {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        // Value label on top of bar
        if (barHeight > 16) {
          ctx.fillStyle = "#f1f5f9";
          ctx.font = "bold 11px -apple-system, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(String(item.value), x + barWidth / 2, y - 4);
        } else if (item.value > 0) {
          ctx.fillStyle = "#cbd5e1";
          ctx.font = "bold 11px -apple-system, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(String(item.value), x + barWidth / 2, y - 4);
        }

        // X-axis label
        ctx.fillStyle = "#94a3b8";
        ctx.font = "11px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        // Truncate long labels
        let label = item.label;
        if (label.length > 10) {
          label = label.substring(0, 9) + "…";
        }
        ctx.fillText(label, x + barWidth / 2, paddingTop + chartHeight + 8);
      });
    };

    scheduleRender(render);
  }, [data, maxValue, scheduleRender]);

  return (
    <div
      data-testid={testId}
      style={{ width: "100%", position: "relative" }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "280px", position: "relative" }}>
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
          aria-label="Bar chart comparing agents"
          role="img"
        />
      </div>
    </div>
  );
}

// =============================================
// Line Chart (Velocity over time)
// =============================================

interface LineChartProps {
  data: LineChartData;
  testId?: string;
}

export function LineChart({
  data,
  testId = "line-chart",
}: LineChartProps): React.ReactElement {
  const { containerRef, canvasRef, scheduleRender } = useCanvasRenderer();
  const points = data.data;
  const maxValue = points.length > 0 ? Math.max(...points.map((p) => p.count), 1) : 1;

  useEffect(() => {
    const render = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.clearRect(0, 0, w, h);

      if (points.length === 0) {
        ctx.fillStyle = "#64748b";
        ctx.font = "14px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("No data", w / 2, h / 2);
        return;
      }

      const paddingLeft = 40;
      const paddingRight = 16;
      const paddingTop = 12;
      const paddingBottom = 50;
      const chartWidth = w - paddingLeft - paddingRight;
      const chartHeight = h - paddingTop - paddingBottom;

      // Y-axis scale
      const yScale = maxValue > 0 ? chartHeight / (maxValue * 1.1) : 1;

      // Draw grid lines
      const gridLines = 5;
      for (let i = 0; i <= gridLines; i++) {
        const y = paddingTop + (chartHeight / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(w - paddingRight, y);
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Y-axis label
        const yVal = Math.round(maxValue * 1.1 * (1 - i / gridLines));
        ctx.fillStyle = "#64748b";
        ctx.font = "10px -apple-system, sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(String(yVal), paddingLeft - 8, y);
      }

      // Calculate x positions for each data point
      const stepX = points.length > 1 ? chartWidth / (points.length - 1) : chartWidth / 2;

      const chartPoints = points.map((p, i) => ({
        x: paddingLeft + (points.length > 1 ? i * stepX : stepX),
        y: paddingTop + chartHeight - p.count * yScale,
      }));

      // Draw filled area under the line
      const gradient = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
      gradient.addColorStop(0, "rgba(59, 130, 246, 0.3)");
      gradient.addColorStop(1, "rgba(59, 130, 246, 0.02)");

      ctx.beginPath();
      ctx.moveTo(chartPoints[0].x, paddingTop + chartHeight);
      for (const point of chartPoints) {
        ctx.lineTo(point.x, point.y);
      }
      ctx.lineTo(chartPoints[chartPoints.length - 1].x, paddingTop + chartHeight);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw line
      ctx.beginPath();
      ctx.moveTo(chartPoints[0].x, chartPoints[0].y);
      for (let i = 1; i < chartPoints.length; i++) {
        ctx.lineTo(chartPoints[i].x, chartPoints[i].y);
      }
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();

      // Draw data points
      chartPoints.forEach((point, i) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#3b82f6";
        ctx.fill();
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // X-axis labels (show every Nth label to avoid crowding)
      const labelInterval = Math.max(1, Math.ceil(points.length / 8));
      points.forEach((p, i) => {
        if (i % labelInterval !== 0 && i !== points.length - 1) return;
        const x = chartPoints[i].x;
        const dateLabel = p.date.slice(5); // "MM-DD" format
        ctx.fillStyle = "#64748b";
        ctx.font = "10px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(dateLabel, x, paddingTop + chartHeight + 8);
      });
    };

    scheduleRender(render);
  }, [points, maxValue, scheduleRender]);

  return (
    <div
      data-testid={testId}
      style={{ width: "100%", position: "relative" }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "280px", position: "relative" }}>
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
          aria-label="Line chart showing velocity over time"
          role="img"
        />
      </div>
    </div>
  );
}

// =============================================
// Pre-built chart wrappers
// =============================================

interface TaskStatusDonutProps {
  statusCounts: Record<string, number>;
  totalTasks: number;
}

export function TaskStatusDonut({
  statusCounts,
  totalTasks,
}: TaskStatusDonutProps): React.ReactElement {
  const data: DonutChartData[] = Object.entries(statusCounts)
    .filter(([, value]) => value > 0)
    .map(([status, value]) => ({
      label: STATUS_LABELS[status] || status,
      value,
      color: STATUS_CHART_COLORS[status] || "#64748b",
    }));

  return (
    <ChartContainer title="Task Status Distribution" testId="status-donut-section">
      <DonutChart data={data} testId="status-donut" />
    </ChartContainer>
  );
}

interface AgentComparisonBarProps {
  agentStats: { agentName: string; tasksCompleted: number; tasksInProgress: number }[];
}

export function AgentComparisonBar({
  agentStats,
}: AgentComparisonBarProps): React.ReactElement {
  const data: BarChartData[] = agentStats.map((agent) => ({
    label: agent.agentName,
    value: agent.tasksCompleted,
  }));

  return (
    <ChartContainer title="Agent Task Completion" testId="agent-comparison-section">
      <BarChart data={data} testId="agent-comparison-bar" />
    </ChartContainer>
  );
}

interface VelocityLineProps {
  velocityData: { date: string; count: number }[];
  isLoading?: boolean;
}

export function VelocityLine({
  velocityData,
  isLoading,
}: VelocityLineProps): React.ReactElement {
  if (isLoading) {
    return (
      <ChartContainer title="Velocity Over Time" testId="velocity-section">
        <div
          style={{
            height: "280px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "#64748b", fontSize: "14px" }}>Loading velocity data...</span>
        </div>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer title="Velocity Over Time" testId="velocity-section">
      <LineChart data={{ data: velocityData }} testId="velocity-line" />
    </ChartContainer>
  );
}
