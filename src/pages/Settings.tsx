import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Edit, Trash2, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Terminal } from 'lucide-react';

interface GoldenRule {
  id: string;
  rule_number: number;
  title: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [rules, setRules] = useState<GoldenRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<GoldenRule | null>(null);
  const [formData, setFormData] = useState({
    rule_number: 0,
    title: '',
    description: '',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadRules();
    }
  }, [user]);

  const loadRules = async () => {
    try {
      const { data, error } = await supabase
        .from('golden_rules')
        .select('*')
        .eq('is_active', true)
        .order('rule_number', { ascending: true });

      if (error) throw error;
      if (data) setRules(data);
    } catch (error) {
      console.error('Error loading rules:', error);
      toast.error(t('settings.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (rule?: GoldenRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        rule_number: rule.rule_number,
        title: rule.title,
        description: rule.description,
      });
    } else {
      setEditingRule(null);
      const nextRuleNumber = rules.length > 0 ? Math.max(...rules.map(r => r.rule_number)) + 1 : 3;
      setFormData({
        rule_number: nextRuleNumber,
        title: '',
        description: '',
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingRule(null);
    setFormData({ rule_number: 0, title: '', description: '' });
  };

  const handleSaveRule = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error(t('settings.fillAllFields'));
      return;
    }

    try {
      if (editingRule) {
        const { error } = await supabase
          .from('golden_rules')
          .update({
            rule_number: formData.rule_number,
            title: formData.title,
            description: formData.description,
          })
          .eq('id', editingRule.id);

        if (error) throw error;
        toast.success(t('settings.ruleUpdated'));
      } else {
        const { error } = await supabase
          .from('golden_rules')
          .insert({
            rule_number: formData.rule_number,
            title: formData.title,
            description: formData.description,
          });

        if (error) throw error;
        toast.success(t('settings.ruleAdded'));
      }

      handleCloseModal();
      loadRules();
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error(t('settings.errorSaving'));
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('golden_rules')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      toast.success(t('settings.ruleDeleted'));
      loadRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error(t('settings.errorDeleting'));
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/app/tours')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('settings.backToDashboard')}
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-4xl font-bold">{t('settings.title')}</h1>
            <p className="text-muted-foreground">
              {t('settings.subtitle')}
            </p>
          </div>
        </div>

        <Tabs defaultValue="rules" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="rules">
              <Shield className="w-4 h-4 mr-2" />
              {t('settings.goldenRules')}
            </TabsTrigger>
            <TabsTrigger value="commands">
              <Terminal className="w-4 h-4 mr-2" />
              Command List
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-2xl">{t('settings.goldenRules')}</CardTitle>
                    <CardDescription>
                      {t('settings.goldenRulesDescription')}
                    </CardDescription>
                  </div>
                  <Button onClick={() => handleOpenModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('settings.addRule')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {rules.map((rule) => (
                    <Card key={rule.id} className="border-l-4 border-l-primary">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-semibold text-primary">
                                Rule #{rule.rule_number}
                              </span>
                            </div>
                            <CardTitle className="text-lg">{rule.title}</CardTitle>
                            <CardDescription className="mt-2">
                              {rule.description}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenModal(rule)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRule(rule.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commands">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Command List</CardTitle>
                <CardDescription>
                  Useful commands to solve common problems in the application
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Card className="border-l-4 border-l-blue-500">
                    <CardHeader>
                      <CardTitle className="text-lg">Fullscreen Components Fix</CardTitle>
                      <CardDescription className="mt-2">
                        <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                          "The [Popover/DropdownMenu/Dialog/Select] doesn't work in fullscreen. Apply the Portal container solution."
                        </span>
                        <p className="mt-2">
                          For Radix UI components that use Portal and don't work in fullscreen mode.
                        </p>
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card className="border-l-4 border-l-green-500">
                    <CardHeader>
                      <CardTitle className="text-lg">Important Keywords</CardTitle>
                      <CardDescription className="mt-2 space-y-1">
                        <p>• <strong>Portal</strong> - Radix UI rendering issue</p>
                        <p>• <strong>fullscreen</strong> - Problem context</p>
                        <p>• <strong>container prop</strong> - The specific solution</p>
                        <p>• <strong>like [previous component]</strong> - Reference to already implemented solution</p>
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card className="border-l-4 border-l-purple-500">
                    <CardHeader>
                      <CardTitle className="text-lg">Components That May Have This Issue</CardTitle>
                      <CardDescription className="mt-2 space-y-1">
                        <p>✅ Popover (fixed)</p>
                        <p>✅ DropdownMenu (fixed)</p>
                        <p>⚠️ Dialog / AlertDialog</p>
                        <p>⚠️ Select</p>
                        <p>⚠️ Tooltip</p>
                        <p>⚠️ HoverCard</p>
                        <p>⚠️ ContextMenu</p>
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRule ? t('settings.editRule') : t('settings.addNewRule')}
              </DialogTitle>
              <DialogDescription>
                {editingRule ? t('settings.updateRuleDescription') : t('settings.createRuleDescription')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="rule_number">{t('settings.ruleNumber')}</Label>
                <Input
                  id="rule_number"
                  type="number"
                  value={formData.rule_number}
                  onChange={(e) => setFormData({ ...formData, rule_number: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label htmlFor="title">{t('settings.title_field')}</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('settings.enterTitle')}
                />
              </div>

              <div>
                <Label htmlFor="description">{t('settings.description')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('settings.enterDescription')}
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseModal}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSaveRule}>
                {editingRule ? t('settings.updateRule') : t('settings.addRule')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Settings;
