import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { Calendar } from 'lucide-react';

const generateMockData = (days: number) => {
  const data = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      views: Math.floor(Math.random() * 100) + 20,
    });
  }
  
  return data;
};

export const ViewsChart = () => {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState(generateMockData(30));

  useEffect(() => {
    setData(generateMockData(period));
  }, [period]);

  return (
    <Card className="p-6 border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold font-futuristic flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {t('inicio.viewsLastMonth')}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 font-body-future">
            Daily views over the selected period
          </p>
        </div>
        
        {/* Period Selector */}
        <div className="flex gap-2">
          <Button
            variant={period === 7 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(7)}
            className="font-body-future"
          >
            7d
          </Button>
          <Button
            variant={period === 30 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(30)}
            className="font-body-future"
          >
            30d
          </Button>
          <Button
            variant={period === 90 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(90)}
            className="font-body-future"
          >
            90d
          </Button>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis 
            dataKey="date" 
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px', fontFamily: 'Exo 2' }}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px', fontFamily: 'Exo 2' }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontFamily: 'Exo 2',
            }}
          />
          <Area
            type="monotone"
            dataKey="views"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            fill="url(#viewsGradient)"
            animationDuration={1000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
};
