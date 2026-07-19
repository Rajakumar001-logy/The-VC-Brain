"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dealFlowByMonth } from "@/lib/mock-data";

export function DealFlowChart() {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Deal flow</CardTitle>
        <CardDescription>Inbound deals vs. investments YTD</CardDescription>
      </CardHeader>
      <CardContent className="h-72 pl-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dealFlowByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
            />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
              }}
            />
            <Legend />
            <Bar dataKey="deals" name="Deals" fill="oklch(0.55 0.12 200)" radius={[4, 4, 0, 0]} />
            <Bar
              dataKey="invested"
              name="Invested"
              fill="oklch(0.45 0.08 160)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
