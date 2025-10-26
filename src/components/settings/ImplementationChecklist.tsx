import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ChecklistItem {
  id: string;
  titleKey: string;
  descriptionKey: string;
  status: 'completed' | 'pending' | 'in-progress';
  priority: 'high' | 'medium' | 'low';
}

export const ImplementationChecklist = () => {
  const { t } = useTranslation();

  const checklistItems: ChecklistItem[] = [
    {
      id: 'multi-user-base',
      titleKey: 'implementation.multiUserBase',
      descriptionKey: 'implementation.multiUserBaseDesc',
      status: 'completed',
      priority: 'high',
    },
    {
      id: 'user-auth',
      titleKey: 'implementation.userAuth',
      descriptionKey: 'implementation.userAuthDesc',
      status: 'completed',
      priority: 'high',
    },
    {
      id: 'auto-admin-role',
      titleKey: 'implementation.autoAdminRole',
      descriptionKey: 'implementation.autoAdminRoleDesc',
      status: 'pending',
      priority: 'high',
    },
    {
      id: 'protect-golden-rules',
      titleKey: 'implementation.protectGoldenRules',
      descriptionKey: 'implementation.protectGoldenRulesDesc',
      status: 'pending',
      priority: 'high',
    },
    {
      id: 'protect-commands',
      titleKey: 'implementation.protectCommands',
      descriptionKey: 'implementation.protectCommandsDesc',
      status: 'pending',
      priority: 'high',
    },
    {
      id: 'role-indicator',
      titleKey: 'implementation.roleIndicator',
      descriptionKey: 'implementation.roleIndicatorDesc',
      status: 'pending',
      priority: 'medium',
    },
    {
      id: 'org-members',
      titleKey: 'implementation.orgMembers',
      descriptionKey: 'implementation.orgMembersDesc',
      status: 'pending',
      priority: 'low',
    },
    {
      id: 'collaboration-system',
      titleKey: 'implementation.collaborationSystem',
      descriptionKey: 'implementation.collaborationSystemDesc',
      status: 'pending',
      priority: 'low',
    },
  ];

  const getPriorityBadge = (priority: ChecklistItem['priority']) => {
    const variants = {
      high: 'destructive',
      medium: 'default',
      low: 'secondary',
    } as const;

    const labels = {
      high: t('implementation.highPriority'),
      medium: t('implementation.mediumPriority'),
      low: t('implementation.lowPriority'),
    };

    return (
      <Badge variant={variants[priority]} className="ml-2">
        {labels[priority]}
      </Badge>
    );
  };

  const getStatusIcon = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'in-progress':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const completedCount = checklistItems.filter(item => item.status === 'completed').length;
  const totalCount = checklistItems.length;
  const progressPercentage = Math.round((completedCount / totalCount) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('implementation.title')}</CardTitle>
        <CardDescription>
          {t('implementation.description')}
        </CardDescription>
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {t('implementation.progress', { completed: completedCount, total: totalCount })}
            </span>
            <span className="text-sm font-semibold">{progressPercentage}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary rounded-full h-2 transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {checklistItems.map((item) => (
            <Card
              key={item.id}
              className={`border-l-4 ${
                item.status === 'completed'
                  ? 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20'
                  : item.priority === 'high'
                  ? 'border-l-red-500'
                  : item.priority === 'medium'
                  ? 'border-l-yellow-500'
                  : 'border-l-blue-500'
              }`}
            >
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {getStatusIcon(item.status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">
                        {t(item.titleKey)}
                      </CardTitle>
                      {getPriorityBadge(item.priority)}
                      {item.status === 'completed' && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                          {t('implementation.completed')}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="mt-2">
                      {t(item.descriptionKey)}
                    </CardDescription>
                  </div>
                  <Checkbox
                    checked={item.status === 'completed'}
                    disabled
                    className="mt-1"
                  />
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
