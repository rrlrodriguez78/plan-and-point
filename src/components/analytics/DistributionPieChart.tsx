import { Card } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useTranslation } from 'react-i18next';
import { Activity } from 'lucide-react';

interface DistributionPieChartProps {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export const DistributionPieChart = ({ views, likes, comments, shares }: DistributionPieChartProps) => {
  const { t } = useTranslation();

  const data = [
    { name: 'Views', value: views || 1 },
    { name: 'Likes', value: likes || 1 },
    { name: 'Comments', value: comments || 1 },
    { name: 'Shares', value: shares || 1 },
  ];

  const total = views + likes + comments + shares;

  return (
    <Card className="p-6 border-2 border-secondary/20 bg-gradient-to-br from-background to-secondary/5 backdrop-blur-sm h-full">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold font-futuristic flex items-center gap-2">
          <Activity className="w-5 h-5 text-secondary" />
          Activity Distribution
        </h3>
        <p className="text-sm text-muted-foreground mt-1 font-body-future">
          Engagement breakdown
        </p>
      </div>

      {/* Chart */}
      {total > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              animationDuration={1000}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontFamily: 'Exo 2',
              }}
            />
            <Legend 
              wrapperStyle={{
                fontFamily: 'Exo 2',
                fontSize: '12px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-72 flex items-center justify-center">
          <p className="text-muted-foreground">No activity data yet</p>
        </div>
      )}
    </Card>
  );
};
