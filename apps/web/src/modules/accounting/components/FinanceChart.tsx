import { calendarDay } from "@/shared/lib/format-utils";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useTransactions } from "@/modules/accounting/hooks/useTransactions";
import { format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/shared/lib/format-utils";
import { toNumber } from "@/modules/accounting/pages/profit-and-loss-calc";

function safeParseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg p-3">
        <p className="font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
            {entry.name === "receitas" && "Receitas: "}
            {entry.name === "despesas" && "Despesas: "}
            {entry.name === "lucro" && "Lucro: "}
            {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function FinanceChart() {
  const { transactions } = useTransactions();

  const chartData = useMemo(() => {
    const today = new Date();
    const months: { month: Date; label: string }[] = [];

    for (let i = 5; i >= 0; i--) {
      const month = startOfMonth(subMonths(today, i));
      months.push({
        month,
        label: format(month, "MMM", { locale: ptBR }),
      });
    }

    return months.map(({ month, label }) => {
      const monthTransactions = transactions.filter(t => {
        // Calendar day, not an instant: a UTC-midnight timestamp parsed in local
        // time would fall into the previous month on the 1st.
        const transactionDate = safeParseDate(calendarDay(t.transaction_date) ? `${calendarDay(t.transaction_date)}T12:00:00` : null);
        if (!transactionDate) return false;
        return (
          transactionDate.getMonth() === month.getMonth() &&
          transactionDate.getFullYear() === month.getFullYear()
        );
      });

      const income = monthTransactions
        .filter(t => t.type === "revenue")
        .reduce((acc, t) => acc + toNumber(t.amount), 0);

      const expenses = monthTransactions
        .filter(t => t.type === "expense")
        .reduce((acc, t) => acc + toNumber(t.amount), 0);

      return {
        name: label.charAt(0).toUpperCase() + label.slice(1),
        receitas: income,
        despesas: expenses,
        lucro: income - expenses,
      };
    });
  }, [transactions]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Evolução Financeira</CardTitle>
        <CardDescription>Receitas, despesas e lucro dos últimos 6 meses</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="name"
                className="text-xs fill-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                className="text-xs fill-muted-foreground"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: "20px" }}
                formatter={(value) => (
                  <span className="text-sm text-muted-foreground capitalize">{value}</span>
                )}
              />
              <Area
                type="monotone"
                dataKey="receitas"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorReceitas)"
              />
              <Area
                type="monotone"
                dataKey="despesas"
                stroke="hsl(0, 84%, 60%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorDespesas)"
              />
              <Area
                type="monotone"
                dataKey="lucro"
                stroke="hsl(221, 83%, 53%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorLucro)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

