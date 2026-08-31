/**
 * Competency Radar Chart
 * 
 * Visualizes user competency scores across 4 domains using a radar/spider chart.
 * 
 * Why: Provides at-a-glance view of skill profile across domains.
 */

"use client";

import { 
  RadarChart, 
  Radar, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis,
  Tooltip,
  Legend,
  ResponsiveContainer 
} from "recharts";

interface RadarDataPoint {
  domain: string;
  current: number;
  required: number;
  percentage: number;
}

interface Props {
  data: RadarDataPoint[];
  width?: number;
  height?: number;
}

const COLORS = {
  current: "#1e40af",
  required: "#0891b2",
};

const DOMAIN_LABELS = {
  "Statistical": "Statistical",
  "Technical": "Technical",
  "Digital Governance": "Digital Gov.",
  "Behavioural": "Behavioural",
};

export default function CompetencyRadarChart({ data, width = 350, height = 350 }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-80 flex items-center justify-center bg-surface-50 rounded-lg">
        <p className="text-surface-500">No competency data available</p>
      </div>
    );
  }

  // Ensure we have all 4 domains
  const domains = ["Statistical", "Technical", "Digital Governance", "Behavioural"];
  const chartData = domains.map(domain => {
    const found = data.find(d => d.domain === domain);
    return {
      domain: DOMAIN_LABELS[domain as keyof typeof DOMAIN_LABELS] || domain,
      current: found?.current || 0,
      required: found?.required || 5,
      percentage: found?.percentage || 0,
    };
  });

  // Calculate max for radius axis
  const maxValue = Math.max(5, Math.max(...chartData.map(d => d.required)));

  return (
    <div className="w-full">
      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart 
            cx="50%" 
            cy="50%" 
            innerRadius={0} 
            outerRadius="70%" 
            data={chartData}
          >
            <PolarGrid 
              gridType="polygon"
              radialLines={false}
              stroke="#e5e7eb"
            />
            <PolarAngleAxis 
              dataKey="domain"
              tick={{ fontSize: 12, fill: "#374151", fontWeight: 500 }}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <PolarRadiusAxis 
              angle={90}
              domain={[0, maxValue]}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              axisLine={false}
            />
            <Tooltip
              content={({ payload }) => {
                if (!payload || !payload[0]) return null;
                const item = payload[0].payload;
                return (
                  <div className="bg-white p-3 rounded-lg shadow-lg border">
                    <p className="font-semibold text-surface-900">{item.domain}</p>
                    <div className="mt-1 space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.current }} />
                        <span>Current: <strong>{item.current.toFixed(1)} / 5</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.required }} />
                        <span>Required: <strong>{item.required.toFixed(1)} / 5</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Gap: <strong className={item.current >= item.required ? "text-green-600" : "text-red-600"}>
                          {item.current >= item.required ? "+" : ""}{(item.current - item.required).toFixed(1)}
                        </strong></span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            <Legend 
              layout="horizontal" 
              align="center" 
              verticalAlign="bottom"
              iconType="circle"
              wrapperStyle={{ paddingTop: 10 }}
            />
            <Radar
              name="Current Level"
              dataKey="current"
              stroke={COLORS.current}
              fill={COLORS.current}
              fillOpacity={0.15}
              strokeWidth={2}
              dot={{ r: 4, strokeWidth: 2, fill: COLORS.current }}
              activeDot={{ r: 6, fill: COLORS.current }}
            />
            <Radar
              name="Required Level"
              dataKey="required"
              stroke={COLORS.required}
              fill={COLORS.required}
              fillOpacity={0.1}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 4, strokeWidth: 2, fill: COLORS.required }}
              activeDot={{ r: 6, fill: COLORS.required }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend & Summary */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {chartData.map((item) => (
          <div 
            key={item.domain} 
            className="p-3 bg-surface-50 rounded-lg border border-surface-100"
          >
            <div className="flex items-center gap-2 mb-1">
              <span 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: COLORS.current }}
              />
              <span className="text-xs font-medium text-surface-700">{item.domain}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-surface-900">{item.current.toFixed(1)}</span>
              <span className="text-surface-500">/ {item.required.toFixed(1)}</span>
            </div>
            <div className="mt-1 h-1.5 bg-surface-200 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.min(100, (item.current / item.required) * 100)}%`,
                  backgroundColor: item.current >= item.required ? "#10b981" : "#f59e0b"
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}