import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore, defaultAiActionPrompts, AiActionPrompts, QuickActionItem, defaultQuickActions, defaultGeneralActions } from '../store';
import {
  Save,
  Play,
  Monitor,
  Sun,
  Moon,
  Settings as SettingsIcon,
  Radio,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Check,
  Palette,
  Sparkles,
  Info,
  Github,
  Mail,
  MessageSquare,
  Send,
  ExternalLink,
  Heart,
  CheckCheck,
  ListTree,
  FileText,
  Shrink,
  Feather,
  BookOpen,
  Languages,
  Table,
  List,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  MousePointerClick,
  X,
  HelpCircle,
  Lightbulb,
  Search,
  ChevronDown,
  ArrowLeft,
  Eye,
  EyeOff
} from 'lucide-react';
import { translations } from '../translations';
import { CustomSelect } from './CustomSelect';
import { useToast } from './Toast';
import { openExternalUrl } from '../services/urlOpener';

export function SettingsScreen() {
  const { settings, updateSettings, activeNoteId, isNoteOpen, setActiveScreen } = useAppStore();
  const t = translations[settings.language] || translations.ar;
  const isRtl = settings.language === 'ar';

  const [localSettings, setLocalSettings] = useState(settings);
  const { showToast } = useToast();

  // Collapsible sections state - all initially collapsed as requested
  const [collapsedSections, setCollapsedSections] = useState<{ [key: string]: boolean }>({
    general: true,
    llm: true,
    quickActions: true,
    about: true,
  });

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Model selection presets & state
  const geminiModelPresets = [
    { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
    { value: 'gemini-2.5-flash-lite', label: 'gemini-2.5-flash-lite' },
    { value: 'gemini-3.5-flash-lite', label: 'gemini-3.5-flash-lite' },
    { value: 'gemini-3.8-flash', label: 'gemini-3.8-flash' },
    { value: 'other', label: isRtl ? 'أخرى (نموذج مخصص)' : 'Other (Custom model)' },
  ];

  const openRouterModelPresets = [
    { value: 'google/gemini-2.5-flash', label: 'google/gemini-2.5-flash' },
    { value: 'google/gemini-2.5-flash-lite', label: 'google/gemini-2.5-flash-lite' },
    { value: 'deepseek/deepseek-chat', label: 'deepseek/deepseek-chat' },
    { value: 'anthropic/claude-3.5-sonnet', label: 'anthropic/claude-3.5-sonnet' },
    { value: 'meta-llama/llama-3.3-70b-instruct', label: 'meta-llama/llama-3.3-70b-instruct' },
    { value: 'other', label: isRtl ? 'أخرى (نموذج مخصص)' : 'Other (Custom model)' },
  ];

  const activeModelPresets = localSettings.llmProvider === 'gemini' ? geminiModelPresets : openRouterModelPresets;
  const isCurrentModelPreset = activeModelPresets.some(p => p.value !== 'other' && p.value === localSettings.llmModel);
  const [isCustomModelMode, setIsCustomModelMode] = useState<boolean>(!isCurrentModelPreset);

  // API Key show/hide and testing state
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestStatus, setKeyTestStatus] = useState<'valid' | 'invalid' | null>(null);
  const [showGeminiGuideModal, setShowGeminiGuideModal] = useState(false);

  const handleTestApiKey = async () => {
    const provider = localSettings.llmProvider;
    const key = provider === 'gemini'
      ? (localSettings.geminiApiKey || '').trim()
      : (localSettings.openRouterApiKey || '').trim();

    if (!key) {
      showToast(isRtl ? 'يرجى إدخال مفتاح API أولاً للاختبار' : 'Please enter an API key first to test', 'error');
      return;
    }

    // Format & Provider cross-validation
    if (provider === 'openrouter') {
      if (key.startsWith('AIzaSy')) {
        setKeyTestStatus('invalid');
        showToast(
          isRtl
            ? 'هذا المفتاح خاص بـ Google Gemini (يبدأ بـ AIzaSy) وليس OpenRouter.'
            : 'This key is a Google Gemini API key (starts with AIzaSy), not OpenRouter.',
          'error'
        );
        return;
      }
      if (!key.startsWith('sk-or-')) {
        setKeyTestStatus('invalid');
        showToast(
          isRtl
            ? 'مفتاح OpenRouter غير صالح. يجب أن يبدأ بـ sk-or-v1-'
            : 'Invalid OpenRouter key format. Keys start with sk-or-v1-',
          'error'
        );
        return;
      }
    } else if (provider === 'gemini') {
      if (key.startsWith('sk-or-')) {
        setKeyTestStatus('invalid');
        showToast(
          isRtl
            ? 'هذا المفتاح خاص بـ OpenRouter (يبدأ بـ sk-or-) وليس Google Gemini.'
            : 'This key is an OpenRouter API key (starts with sk-or-), not Google Gemini.',
          'error'
        );
        return;
      }
      if (!key.startsWith('AIzaSy')) {
        setKeyTestStatus('invalid');
        showToast(
          isRtl
            ? 'مفتاح Google Gemini يجب أن يبدأ بـ AIzaSy'
            : 'Google Gemini keys should start with AIzaSy',
          'error'
        );
        return;
      }
    }

    setIsTestingKey(true);
    setKeyTestStatus(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.models) {
          setKeyTestStatus('valid');
          showToast(isRtl ? 'مفتاح Gemini صالح ويعمل بنجاح!' : 'Gemini API Key is valid and working!', 'success');
        } else {
          setKeyTestStatus('invalid');
          const errDetail = data?.error?.message || (isRtl ? 'المفتاح غير صالح أو الحساب غير مفعل' : 'Invalid API key or account unauthorized');
          showToast(errDetail, 'error');
        }
      } else if (provider === 'openrouter') {
        const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Authorization': `Bearer ${key}`
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.data && (data.data.label !== undefined || data.data.limit !== undefined || data.data.usage !== undefined)) {
          setKeyTestStatus('valid');
          showToast(isRtl ? 'مفتاح OpenRouter صالح ويعمل بنجاح!' : 'OpenRouter API Key is valid and working!', 'success');
        } else {
          setKeyTestStatus('invalid');
          const errDetail = data?.error?.message || (isRtl ? 'المفتاح غير صالح' : 'Invalid API key');
          showToast(errDetail, 'error');
        }
      } else {
        setIsTestingKey(false);
      }
    } catch (err: any) {
      setKeyTestStatus('invalid');
      if (err.name === 'AbortError') {
        showToast(isRtl ? 'انتهت مهلة اختبار الاتصال' : 'Connection test timed out', 'error');
      } else {
        showToast(isRtl ? 'تعذر الاتصال بالخادم، تحقق من اتصال الإنترنت' : 'Could not connect to API server, check internet', 'error');
      }
    } finally {
      setIsTestingKey(false);
    }
  };

  // Paper Background Color Palettes requested by user
  const lightPaperColors = [
    { hex: '#ffedd5', label: 'Warm Peach' },
    { hex: '#fed7aa', label: 'Soft Amber' },
    { hex: '#f5f5f5', label: 'Light Gray' },
    { hex: '#fafafa', label: 'Paper White' },
    { hex: '#fef3c7', label: 'Warm Yellow' },
  ];

  const darkPaperColors = [
    { hex: '#262626', label: 'Neutral Dark' },
    { hex: '#171717', label: 'Deep Slate' },
    { hex: '#1c1917', label: 'Warm Stone' },
    { hex: '#0c0a09', label: 'Midnight Black' },
    { hex: '#18181b', label: 'Zinc Dark' },
  ];

  const handleSelectPaperColor = (type: 'light' | 'dark', hex: string) => {
    if (type === 'light') {
      setLocalSettings(prev => ({ ...prev, lightPaperColor: hex }));
      updateSettings({ lightPaperColor: hex });
    } else {
      setLocalSettings(prev => ({ ...prev, darkPaperColor: hex }));
      updateSettings({ darkPaperColor: hex });
    }
  };

  // ── Quick & General Actions State & Handlers ──
  const [editingAction, setEditingAction] = useState<QuickActionItem | null>(null);
  const [isCreatingAction, setIsCreatingAction] = useState(false);
  const [actionTarget, setActionTarget] = useState<'quick' | 'general'>('quick');
  const [actionForm, setActionForm] = useState<{
    id?: string;
    name: string;
    nameAr: string;
    icon: string;
    prompt: string;
    enabled: boolean;
  }>({
    name: '',
    nameAr: '',
    icon: 'Lightbulb',
    prompt: '',
    enabled: true,
  });

  const getActionIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Sparkles': return Sparkles;
      case 'Check': return Check;
      case 'CheckCheck': return CheckCheck;
      case 'ListTree': return ListTree;
      case 'FileText': return FileText;
      case 'Shrink': return Shrink;
      case 'Feather': return Feather;
      case 'BookOpen': return BookOpen;
      case 'Languages': return Languages;
      case 'List': return List;
      case 'Table': return Table;
      case 'HelpCircle': return HelpCircle;
      case 'Lightbulb': return Lightbulb;
      case 'Search': return Search;
      default: return Lightbulb;
    }
  };

  const handleOpenAddAction = (target: 'quick' | 'general' = 'quick') => {
    setActionTarget(target);
    setActionForm({
      name: '',
      nameAr: '',
      icon: 'Lightbulb',
      prompt: '',
      enabled: true,
    });
    setEditingAction(null);
    setIsCreatingAction(true);
  };

  const handleOpenEditAction = (action: QuickActionItem, target: 'quick' | 'general' = 'quick') => {
    setActionTarget(target);
    setActionForm({
      id: action.id,
      name: action.name,
      nameAr: action.nameAr || '',
      icon: action.icon || 'Lightbulb',
      prompt: action.prompt,
      enabled: action.enabled !== false,
    });
    setEditingAction(action);
    setIsCreatingAction(true);
  };

  const handleSaveActionForm = () => {
    if (!actionForm.name.trim() || !actionForm.prompt.trim()) {
      showToast(isRtl ? 'يرجى إدخال اسم الإجراء والأمر' : 'Please enter action name and prompt', 'warning');
      return;
    }

    if (actionTarget === 'general') {
      const currentList = localSettings.generalActions || settings.generalActions || defaultGeneralActions;
      if (editingAction) {
        const updated = currentList.map(a =>
          a.id === editingAction.id
            ? { ...a, ...actionForm }
            : a
        );
        setLocalSettings(prev => ({ ...prev, generalActions: updated }));
        updateSettings({ generalActions: updated });
        showToast(isRtl ? 'تم تحديث الإجراء بنجاح' : 'Action updated successfully', 'success');
      } else {
        const newAction: QuickActionItem = {
          id: `general_${Date.now()}`,
          name: actionForm.name.trim(),
          nameAr: actionForm.nameAr.trim() || undefined,
          icon: actionForm.icon,
          prompt: actionForm.prompt.trim(),
          enabled: actionForm.enabled,
          isCustom: true,
        };
        const updated = [...currentList, newAction];
        setLocalSettings(prev => ({ ...prev, generalActions: updated }));
        updateSettings({ generalActions: updated });
        showToast(isRtl ? 'تمت إضافة الإجراء بنجاح' : 'Action created successfully', 'success');
      }
    } else {
      const currentList = localSettings.quickActions || settings.quickActions || defaultQuickActions;
      if (editingAction) {
        const updated = currentList.map(a =>
          a.id === editingAction.id
            ? { ...a, ...actionForm }
            : a
        );
        setLocalSettings(prev => ({ ...prev, quickActions: updated }));
        updateSettings({ quickActions: updated });
        showToast(isRtl ? 'تم تحديث الإجراء بنجاح' : 'Action updated successfully', 'success');
      } else {
        const newAction: QuickActionItem = {
          id: `custom_${Date.now()}`,
          name: actionForm.name.trim(),
          nameAr: actionForm.nameAr.trim() || undefined,
          icon: actionForm.icon,
          prompt: actionForm.prompt.trim(),
          enabled: actionForm.enabled,
          isCustom: true,
        };
        const updated = [...currentList, newAction];
        setLocalSettings(prev => ({ ...prev, quickActions: updated }));
        updateSettings({ quickActions: updated });
        showToast(isRtl ? 'تمت إضافة الإجراء بنجاح' : 'Action created successfully', 'success');
      }
    }

    setIsCreatingAction(false);
    setEditingAction(null);
  };

  const handleDeleteAction = (id: string, target: 'quick' | 'general' = 'quick') => {
    if (target === 'general') {
      const currentList = localSettings.generalActions || settings.generalActions || defaultGeneralActions;
      const updated = currentList.filter(a => a.id !== id);
      setLocalSettings(prev => ({ ...prev, generalActions: updated }));
      updateSettings({ generalActions: updated });
      showToast(isRtl ? 'تم حذف الإجراء' : 'Action removed', 'info');
    } else {
      const currentList = localSettings.quickActions || settings.quickActions || defaultQuickActions;
      const updated = currentList.filter(a => a.id !== id);
      setLocalSettings(prev => ({ ...prev, quickActions: updated }));
      updateSettings({ quickActions: updated });
      showToast(isRtl ? 'تم حذف الإجراء' : 'Action removed', 'info');
    }
  };

  const handleToggleAction = (id: string, target: 'quick' | 'general' = 'quick') => {
    if (target === 'general') {
      const currentList = localSettings.generalActions || settings.generalActions || defaultGeneralActions;
      const updated = currentList.map(a => a.id === id ? { ...a, enabled: a.enabled === false ? true : false } : a);
      setLocalSettings(prev => ({ ...prev, generalActions: updated }));
      updateSettings({ generalActions: updated });
    } else {
      const currentList = localSettings.quickActions || settings.quickActions || defaultQuickActions;
      const updated = currentList.map(a => a.id === id ? { ...a, enabled: a.enabled === false ? true : false } : a);
      setLocalSettings(prev => ({ ...prev, quickActions: updated }));
      updateSettings({ quickActions: updated });
    }
  };

  const handleResetActions = (target: 'quick' | 'general' = 'quick') => {
    if (target === 'general') {
      setLocalSettings(prev => ({ ...prev, generalActions: defaultGeneralActions }));
      updateSettings({ generalActions: defaultGeneralActions });
      showToast(isRtl ? 'تمت استعادة الإجراءات العامة الافتراضية' : 'Reset to default general actions', 'success');
    } else {
      setLocalSettings(prev => ({ ...prev, quickActions: defaultQuickActions }));
      updateSettings({ quickActions: defaultQuickActions });
      showToast(isRtl ? 'تمت استعادة الإجراءات السريعة الافتراضية' : 'Reset to default quick actions', 'success');
    }
  };


  const handleSave = () => {
    updateSettings(localSettings);
    showToast('Settings saved successfully!', 'success');
  };


  const providerOptions = [
    { value: 'gemini', label: 'Google Gemini (API Key)' },
    { value: 'openrouter', label: 'OpenRouter' },
  ];

  const themeOptions = [
    { value: 'light', label: t.light, icon: Sun },
    { value: 'dark', label: t.dark, icon: Moon },
    { value: 'system', label: t.system, icon: Monitor },
  ];

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'ar', label: 'العربية (Arabic)' },
    { value: 'fr', label: 'Français (French)' },
  ];

  const currentLightColor = localSettings.lightPaperColor || '#fafafa';
  const currentDarkColor = localSettings.darkPaperColor || '#171717';

  return (
    <div className="flex flex-col h-full bg-card md:rounded-2xl md:border md:border-border overflow-hidden shadow-sm animate-in fade-in" dir={localSettings.language === 'ar' ? 'rtl' : 'ltr'}>

      <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-6 max-w-2xl mx-auto w-full">
        {/* ─────────────────────────────────────────────────────────────
            1. TOP SECTION: GENERAL (UI Settings placed at the top)
            ───────────────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => toggleSection('general')}
            className="w-full flex items-center justify-between pb-2 border-b border-border text-left rtl:text-right cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-transparent rounded-lg">
                <Palette className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                {isRtl ? 'عام' : 'General'}
              </h3>
            </div>
            <div className="p-1 rounded-md text-muted-foreground group-hover:text-foreground">
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${collapsedSections.general ? '-rotate-90 rtl:rotate-90' : 'rotate-0'}`} />
            </div>
          </button>

          <AnimatePresence initial={false}>
            {!collapsedSections.general && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="bg-muted/30 p-4 md:p-5 rounded-2xl border border-border space-y-5">
                  {/* Theme Selector */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">{t.theme}</label>
                    <CustomSelect
                      value={localSettings.theme}
                      options={themeOptions}
                      onChange={(val) => {
                        setLocalSettings({ ...localSettings, theme: val as any });
                        updateSettings({ theme: val as any });
                      }}
                    />
                  </div>


                  {/* App Language */}
                  <div className="pt-2 border-t border-border/60">
                    <label className="block text-sm font-semibold text-foreground mb-1.5">App Language</label>
                    <CustomSelect
                      value={localSettings.language}
                      options={languageOptions}
                      onChange={(val) => {
                        setLocalSettings({ ...localSettings, language: val as any });
                        updateSettings({ language: val as any });
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            2. LLM & AI PROVIDER SETTINGS
            ───────────────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => toggleSection('llm')}
            className="w-full flex items-center justify-between pb-2 border-b border-border text-left rtl:text-right cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-transparent rounded-lg">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                {isRtl ? 'الذكاء الاصطناعي والمزود' : 'AI & LLM Provider'}
              </h3>
            </div>
            <div className="p-1 rounded-md text-muted-foreground group-hover:text-foreground">
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${collapsedSections.llm ? '-rotate-90 rtl:rotate-90' : 'rotate-0'}`} />
            </div>
          </button>

          <AnimatePresence initial={false}>
            {!collapsedSections.llm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="bg-muted/30 p-4 md:p-5 rounded-2xl border border-border space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{t.llmProvider}</label>
                    <CustomSelect
                      value={localSettings.llmProvider}
                      options={providerOptions}
                      onChange={(val) => {
                        const newProvider = val as any;
                        let newModel = localSettings.llmModel;
                        if (!isCustomModelMode) {
                          if (newProvider === 'gemini') {
                            newModel = 'gemini-2.5-flash';
                          } else if (newProvider === 'openrouter') {
                            newModel = 'google/gemini-2.5-flash';
                          }
                        }
                        const updated = { ...localSettings, llmProvider: newProvider, llmModel: newModel };
                        setLocalSettings(updated);
                        updateSettings({ llmProvider: newProvider, llmModel: newModel });
                      }}
                    />
                  </div>

                  {/* API KEY INPUT FOR GEMINI / OPENROUTER */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      {t.apiKey} <span className="text-xs text-muted-foreground font-normal">({localSettings.llmProvider === 'gemini' ? 'Google Gemini' : 'OpenRouter'})</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 flex items-center">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          autoComplete="new-password"
                          className="w-full border border-border bg-background rounded-lg p-2.5 pe-10 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow font-mono"
                          value={localSettings.llmProvider === 'gemini' ? localSettings.geminiApiKey : localSettings.openRouterApiKey}
                          onChange={(e) => {
                            const val = e.target.value;
                            setKeyTestStatus(null);
                            if (localSettings.llmProvider === 'gemini') {
                              setLocalSettings({ ...localSettings, geminiApiKey: val });
                              updateSettings({ geminiApiKey: val });
                            } else {
                              setLocalSettings({ ...localSettings, openRouterApiKey: val });
                              updateSettings({ openRouterApiKey: val });
                            }
                          }}
                          placeholder={
                            localSettings.llmProvider === 'gemini'
                              ? (isRtl ? 'أدخل مفتاح Gemini (يبدأ بـ AIzaSy)' : 'Enter Gemini key (starts with AIzaSy)')
                              : (isRtl ? 'أدخل مفتاح OpenRouter (يبدأ بـ sk-or-v1-)' : 'Enter OpenRouter key (starts with sk-or-v1-)')
                          }
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute end-2.5 p-1 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
                          title={showApiKey ? (isRtl ? 'إخفاء' : 'Hide') : (isRtl ? 'إظهار' : 'Show')}
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleTestApiKey}
                        disabled={isTestingKey}
                        className="px-3.5 py-2.5 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title={isRtl ? 'اختبار صلاحية المفتاح' : 'Test API key validity'}
                      >
                        {isTestingKey ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : keyTestStatus === 'valid' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : keyTestStatus === 'invalid' ? (
                          <AlertCircle className="w-4 h-4 text-destructive" />
                        ) : null}
                        <span>{isTestingKey ? (t.testingApiKey || (isRtl ? 'جاري الاختبار...' : 'Testing...')) : (t.testApiKey || (isRtl ? 'اختبار' : 'Test'))}</span>
                      </button>
                    </div>

                    {/* Key Provider Mismatch Helper Banners */}
                    {localSettings.llmProvider === 'openrouter' && (localSettings.openRouterApiKey || '').trim().startsWith('AIzaSy') && (
                      <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 mt-2">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{isRtl ? 'هذا مفتاح Google Gemini (يبدأ بـ AIzaSy).' : 'This looks like a Google Gemini key (starts with AIzaSy).'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const val = localSettings.openRouterApiKey;
                            const updated = { ...localSettings, llmProvider: 'gemini' as any, geminiApiKey: val, openRouterApiKey: '' };
                            setLocalSettings(updated);
                            updateSettings({ llmProvider: 'gemini', geminiApiKey: val, openRouterApiKey: '' });
                            setKeyTestStatus(null);
                          }}
                          className="text-primary font-semibold hover:underline shrink-0 ps-2 cursor-pointer"
                        >
                          {isRtl ? 'التبديل إلى Google Gemini' : 'Switch to Google Gemini'}
                        </button>
                      </div>
                    )}

                    {localSettings.llmProvider === 'gemini' && (localSettings.geminiApiKey || '').trim().startsWith('sk-or-') && (
                      <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 mt-2">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{isRtl ? 'هذا مفتاح OpenRouter (يبدأ بـ sk-or-).' : 'This looks like an OpenRouter key (starts with sk-or-).'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const val = localSettings.geminiApiKey;
                            const updated = { ...localSettings, llmProvider: 'openrouter' as any, openRouterApiKey: val, geminiApiKey: '' };
                            setLocalSettings(updated);
                            updateSettings({ llmProvider: 'openrouter', openRouterApiKey: val, geminiApiKey: '' });
                            setKeyTestStatus(null);
                          }}
                          className="text-primary font-semibold hover:underline shrink-0 ps-2 cursor-pointer"
                        >
                          {isRtl ? 'التبديل إلى OpenRouter' : 'Switch to OpenRouter'}
                        </button>
                      </div>
                    )}

                    {localSettings.llmProvider === 'gemini' && (
                      <div className="flex items-center justify-between text-xs mt-2 px-0.5">
                        <button
                          type="button"
                          onClick={() => openExternalUrl('https://aistudio.google.com/app/apikey')}
                          className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium cursor-pointer"
                        >
                          <span>{t.getFreeGeminiKey || (isRtl ? 'احصل على مفتاح Gemini مجاناً' : 'Get your free Gemini API Key')}</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowGeminiGuideModal(true)}
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                          title={t.howToGetApiKey || (isRtl ? 'شرح كيفية الحصول على مفتاح مجاني' : 'How to get a free API key')}
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {localSettings.llmProvider !== 'sidecar' && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-foreground">{t.modelName}</label>
                      <CustomSelect
                        value={isCustomModelMode || !isCurrentModelPreset ? 'other' : localSettings.llmModel}
                        options={activeModelPresets}
                        onChange={(val) => {
                          if (val === 'other') {
                            setIsCustomModelMode(true);
                          } else {
                            setIsCustomModelMode(false);
                            setLocalSettings(prev => ({ ...prev, llmModel: val }));
                            updateSettings({ llmModel: val });
                          }
                        }}
                      />
                      {(isCustomModelMode || !isCurrentModelPreset) && (
                        <div className="pt-1">
                          <label className="block text-xs font-medium text-muted-foreground mb-1">
                            {isRtl ? 'أدخل اسم النموذج المخصص:' : 'Enter custom model name:'}
                          </label>
                          <input
                            type="text"
                            className="w-full border border-border bg-background rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow font-mono"
                            value={localSettings.llmModel}
                            onChange={(e) => {
                              const val = e.target.value;
                              setLocalSettings(prev => ({ ...prev, llmModel: val }));
                              updateSettings({ llmModel: val });
                            }}
                            placeholder={localSettings.llmProvider === 'gemini' ? 'e.g. gemini-1.5-pro' : 'e.g. mistralai/mistral-large'}
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                  )}


                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
        {/* ─────────────────────────────────────────────────────────────
            3. SMART SELECTION QUICK ACTIONS MANAGER
            ───────────────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => toggleSection('quickActions')}
            className="w-full flex items-center justify-between pb-2 border-b border-border text-left rtl:text-right cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-transparent rounded-lg">
                <MousePointerClick className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                {isRtl ? 'الإجراءات والأوامر الذكية' : 'AI Actions & Prompts'}
              </h3>
            </div>
            <div className="p-1 rounded-md text-muted-foreground group-hover:text-foreground">
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${collapsedSections.quickActions ? '-rotate-90 rtl:rotate-90' : 'rotate-0'}`} />
            </div>
          </button>

          <AnimatePresence initial={false}>
            {!collapsedSections.quickActions && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden space-y-5"
              >
                {/* 1. General Edits (التعديلات العامة) */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">
                        {isRtl ? 'التعديلات العامة' : 'General edits'}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isRtl
                          ? 'تخصيص إجراءات الزر العائم في محرر الملاحظات. يمكنك إضافة أو تعديل أو تفعيل أي إجراء في أي وقت.'
                          : 'Customize floating AI actions in note editor. Add, edit, toggle, or remove actions anytime.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleResetActions('general')}
                        className="px-3 py-1.5 rounded-lg border border-border bg-transparent hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title={isRtl ? 'استعادة الإجراءات الافتراضية' : 'Reset to default actions'}
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{isRtl ? 'استعادة الافتراضية' : 'Reset Defaults'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenAddAction('general')}
                        className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isRtl ? 'إضافة إجراء جديد' : 'Add Action'}</span>
                      </button>
                    </div>
                  </div>

                  {/* General Actions List (x2 grid view in a row) */}
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    {(localSettings.generalActions || settings.generalActions || defaultGeneralActions).map((action) => {
                      const Icon = getActionIconComponent(action.icon);
                      const isEnabled = action.enabled !== false;

                      return (
                        <div
                          key={action.id}
                          className={`p-2.5 sm:p-3 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${isEnabled
                            ? 'bg-card/70 border-border hover:border-primary/40 shadow-xs'
                            : 'bg-muted/20 border-border/40 opacity-60'
                            }`}
                        >
                          {/* Top Row: Icon, Titles */}
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-foreground truncate">
                                {isRtl ? (action.nameAr || action.name) : action.name}
                              </h4>
                              {action.nameAr && action.nameAr !== action.name && (
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {isRtl ? action.name : action.nameAr}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Bottom Row: Toggle beside Edit & Delete buttons (no labels) */}
                          <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleAction(action.id, 'general')}
                              className={`w-8 h-4.5 rounded-full transition-colors relative cursor-pointer shrink-0 ${isEnabled ? 'bg-primary' : 'bg-muted'}`}
                              title={isEnabled ? (isRtl ? 'تعطيل' : 'Disable') : (isRtl ? 'تفعيل' : 'Enable')}
                            >
                              <span
                                className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-3.5 rtl:-translate-x-3.5' : 'translate-x-0.5 rtl:-translate-x-0.5'}`}
                              />
                            </button>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditAction(action, 'general')}
                                className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors cursor-pointer"
                                title={isRtl ? 'تعديل' : 'Edit'}
                              >
                                <Edit2 className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAction(action.id, 'general')}
                                className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                title={isRtl ? 'حذف' : 'Delete'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Quick Edits (التعديلات السريعة) */}
                <div className="pt-4 border-t border-border/60 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">
                        {isRtl ? 'التعديلات السريعة' : 'Quick edits'}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isRtl
                          ? 'تخصيص الإجراءات السريعة التي تظهر عند النقر بزر الفأرة الأيمن أو تحديد نص. يمكنك إضافة أو تعديل أو حذف أي إجراء في أي وقت.'
                          : 'Customize quick actions that appear on right-click or text selection. Add, edit, or remove any action anytime.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleResetActions('quick')}
                        className="px-3 py-1.5 rounded-lg border border-border bg-transparent hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title={isRtl ? 'استعادة الإجراءات الافتراضية' : 'Reset to default actions'}
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{isRtl ? 'استعادة الافتراضية' : 'Reset Defaults'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenAddAction('quick')}
                        className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isRtl ? 'إضافة إجراء جديد' : 'Add Action'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Quick Actions List (x2 grid view in a row) */}
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    {(localSettings.quickActions || settings.quickActions || defaultQuickActions).map((action) => {
                      const Icon = getActionIconComponent(action.icon);
                      const isEnabled = action.enabled !== false;

                      return (
                        <div
                          key={action.id}
                          className={`p-2.5 sm:p-3 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${isEnabled
                            ? 'bg-card/70 border-border hover:border-primary/40 shadow-xs'
                            : 'bg-muted/20 border-border/40 opacity-60'
                            }`}
                        >
                          {/* Top Row: Icon, Titles */}
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-foreground truncate">
                                {isRtl ? (action.nameAr || action.name) : action.name}
                              </h4>
                              {action.nameAr && action.nameAr !== action.name && (
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {isRtl ? action.name : action.nameAr}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Bottom Row: Toggle beside Edit & Delete buttons (no labels) */}
                          <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleAction(action.id, 'quick')}
                              className={`w-8 h-4.5 rounded-full transition-colors relative cursor-pointer shrink-0 ${isEnabled ? 'bg-primary' : 'bg-muted'}`}
                              title={isEnabled ? (isRtl ? 'تعطيل' : 'Disable') : (isRtl ? 'تفعيل' : 'Enable')}
                            >
                              <span
                                className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-3.5 rtl:-translate-x-3.5' : 'translate-x-0.5 rtl:-translate-x-0.5'}`}
                              />
                            </button>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditAction(action, 'quick')}
                                className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors cursor-pointer"
                                title={isRtl ? 'تعديل' : 'Edit'}
                              >
                                <Edit2 className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAction(action.id, 'quick')}
                                className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                title={isRtl ? 'حذف' : 'Delete'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            4. ABOUT TAQYEED AI & DEVELOPER SECTION
            ───────────────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => toggleSection('about')}
            className="w-full flex items-center justify-between pb-2 border-b border-border text-left rtl:text-right cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-transparent rounded-lg">
                <Info className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                {t.about || (isRtl ? 'حول تقييد AI' : 'About Taqyeed AI')}
              </h3>
            </div>
            <div className="p-1 rounded-md text-muted-foreground group-hover:text-foreground">
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${collapsedSections.about ? '-rotate-90 rtl:rotate-90' : 'rotate-0'}`} />
            </div>
          </button>

          <AnimatePresence initial={false}>
            {!collapsedSections.about && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="bg-muted/30 p-5 md:p-6 rounded-2xl border border-border space-y-5">
                  {/* App Branding & Author */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-4 border-b border-border/60">
                    <div className="w-14 h-14 rounded-2xl bg-transparent border border-border flex items-center justify-center p-2 shrink-0 shadow-sm">
                      <img src="/logo.svg" alt="Taqyeed AI Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-lg font-bold text-foreground tracking-tight">
                          {t.appName}
                        </h4>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          v1.0.0
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          MIT License
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        <span>
                          {isRtl
                            ? 'تم تطوير هذا المشروع من طرف عقبة بوبكر - الجزائر'
                            : 'This project was made by Boubakeur Okba - Algeria'}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Social & Contact Channels */}
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                      {isRtl ? 'التواصل والشبكات الاجتماعية' : 'Social & Contact'}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* GitHub */}
                      <a
                        href="https://github.com/okba-boubakeur"
                        onClick={(e) => {
                          e.preventDefault();
                          openExternalUrl('https://github.com/okba-boubakeur');
                        }}
                        className="flex items-center justify-between p-3 rounded-xl bg-background/80 hover:bg-background border border-border hover:border-primary/50 text-foreground transition-all group shadow-sm cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-transparent text-foreground flex items-center justify-center shrink-0">
                            <Github className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold">GitHub</div>
                            <div className="text-[11px] text-muted-foreground truncate">@okba-boubakeur</div>
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      </a>

                      {/* Gmail */}
                      <a
                        href="mailto:okba.office4@gmail.com"
                        onClick={(e) => {
                          e.preventDefault();
                          openExternalUrl('mailto:okba.office4@gmail.com');
                        }}
                        className="flex items-center justify-between p-3 rounded-xl bg-background/80 hover:bg-background border border-border hover:border-rose-500/50 text-foreground transition-all group shadow-sm cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-transparent text-rose-500 flex items-center justify-center shrink-0">
                            <Mail className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold">Gmail</div>
                            <div className="text-[11px] text-muted-foreground truncate">okba.office4@gmail.com</div>
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-rose-500 transition-colors shrink-0" />
                      </a>

                      {/* WhatsApp */}
                      <a
                        href="https://wa.me/213792429380"
                        onClick={(e) => {
                          e.preventDefault();
                          openExternalUrl('https://wa.me/213792429380');
                        }}
                        className="flex items-center justify-between p-3 rounded-xl bg-background/80 hover:bg-background border border-border hover:border-emerald-500/50 text-foreground transition-all group shadow-sm cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-transparent text-emerald-500 flex items-center justify-center shrink-0">
                            <MessageSquare className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold">WhatsApp</div>
                            <div className="text-[11px] text-muted-foreground truncate">+213 792 42 93 80</div>
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-emerald-500 transition-colors shrink-0" />
                      </a>

                      {/* Telegram */}
                      <a
                        href="https://t.me/okba_boubakeur"
                        onClick={(e) => {
                          e.preventDefault();
                          openExternalUrl('https://t.me/okba_boubakeur');
                        }}
                        className="flex items-center justify-between p-3 rounded-xl bg-background/80 hover:bg-background border border-border hover:border-sky-500/50 text-foreground transition-all group shadow-sm cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-transparent text-sky-500 flex items-center justify-center shrink-0">
                            <Send className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold">Telegram</div>
                            <div className="text-[11px] text-muted-foreground truncate">@okba_boubakeur</div>
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-sky-500 transition-colors shrink-0" />
                      </a>
                    </div>
                  </div>

                  {/* Call for Contribution Card (Identical layout to GitHub social card with floating button gradient/outline) */}
                  <a
                    href="https://github.com/okba-boubakeur/Taqyeed-AI"
                    onClick={(e) => {
                      e.preventDefault();
                      openExternalUrl('https://github.com/okba-boubakeur/Taqyeed-AI');
                    }}
                    className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-800 hover:from-emerald-400 hover:via-emerald-500 hover:to-emerald-700 border border-emerald-400/50 text-white shadow-md shadow-emerald-600/20 transition-all group cursor-pointer active:scale-[0.99]"
                    title={isRtl ? 'المساهمة في المشروع على GitHub' : 'Contribute on Github'}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/20 text-white flex items-center justify-center shrink-0">
                        <Github className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-white">Contribute on Github</div>
                        <div className="text-[11px] text-white/80 truncate">MIT Licence</div>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-white/80 group-hover:text-white transition-colors shrink-0" />
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <div className="pt-4 pb-12 md:pb-4 flex justify-end">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-colors font-medium shadow-sm cursor-pointer"
          >
            <Save className="w-5 h-5" />
            {t.saveChanges}
          </button>
        </div>

        {/* ── Add / Edit Quick Action Modal ── */}
        <AnimatePresence>
          {isCreatingAction && (
            <div
              className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
              onClick={() => setIsCreatingAction(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
                dir={isRtl ? 'rtl' : 'ltr'}
              >
                {/* Modal Header (Clean close button only) */}
                <div className="px-4 py-3 border-b border-border/60 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setIsCreatingAction(false)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-5 overflow-y-auto space-y-4 flex-1">
                  {/* Name Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        {isRtl ? 'اسم الإجراء (بالإنجليزية)' : 'Action Name (English)'} *
                      </label>
                      <input
                        type="text"
                        value={actionForm.name}
                        onChange={(e) => setActionForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Grammar Polish"
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        {isRtl ? 'اسم الإجراء (بالعربية)' : 'Action Name (Arabic)'}
                      </label>
                      <input
                        type="text"
                        value={actionForm.nameAr}
                        onChange={(e) => setActionForm(prev => ({ ...prev, nameAr: e.target.value }))}
                        placeholder="مثال: تنقيح نحوي"
                        dir="rtl"
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  {/* System Prompt */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        {isRtl ? 'الأمر البرمجي (System Prompt)' : 'System Prompt Instructions'} *
                      </label>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {actionForm.prompt.length} chars
                      </span>
                    </div>
                    <textarea
                      rows={12}
                      value={actionForm.prompt}
                      onChange={(e) => setActionForm(prev => ({ ...prev, prompt: e.target.value }))}
                      placeholder={actionTarget === 'general' ? (isRtl ? 'أدخل تعليمات وأمر الذكاء الاصطناعي لمعالجة الملاحظة كاملة...' : 'Enter prompt instructions for full note AI processing...') : (isRtl ? 'أدخل تعليمات وأمر الذكاء الاصطناعي للنص المحدد...' : 'Enter prompt instructions for what to do with selected text...')}
                      className="w-full min-h-[220px] bg-background border border-border rounded-xl p-3.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 leading-relaxed resize-y"
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-border flex items-center justify-end gap-2 bg-muted/20">
                  <button
                    type="button"
                    onClick={() => setIsCreatingAction(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveActionForm}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{editingAction ? (isRtl ? 'حفظ التعديلات' : 'Update Action') : (isRtl ? 'إضافة الإجراء' : 'Create Action')}</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Gemini API Key Guide Overlay Modal */}
          {showGeminiGuideModal && (
            <div
              className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
              onClick={() => setShowGeminiGuideModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-md flex flex-col overflow-hidden"
                dir={isRtl ? 'rtl' : 'ltr'}
              >
                {/* Modal Header */}
                <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-muted rounded-lg text-foreground">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-bold text-foreground">
                      {isRtl ? 'كيفية الحصول على مفتاح Gemini مجاني' : localSettings.language === 'fr' ? 'Comment obtenir une clé Gemini gratuite' : 'How to Get a Free Gemini API Key'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGeminiGuideModal(false)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-5 overflow-y-auto space-y-4 text-sm max-h-[75vh]">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isRtl
                      ? 'توفر Google مفاتيح API مجانية لنموذج Gemini للاستخدام الشخصي مع حدود استخدام يومية سخية ودون الحاجة لبطاقة مصرفية.'
                      : localSettings.language === 'fr'
                      ? 'Google fournit des clés API gratuites pour les modèles Gemini avec des quotas quotidiens généreux, sans aucune carte bancaire requise.'
                      : 'Google offers free API access to Gemini models with generous rate limits, no credit card required.'}
                  </p>

                  <div className="space-y-2.5 pt-1">
                    {/* Step 1 */}
                    <div className="flex items-start gap-3 bg-muted/30 p-3 rounded-xl border border-border/60">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground text-xs">
                          {isRtl ? 'افتح موقع Google AI Studio' : localSettings.language === 'fr' ? 'Ouvrez Google AI Studio' : 'Open Google AI Studio'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isRtl ? 'انتقل إلى بوابة المطورين Google AI Studio عبر الزر أدناه.' : localSettings.language === 'fr' ? 'Accédez au portail Google AI Studio via le bouton ci-dessous.' : 'Go to Google AI Studio via the button below.'}
                        </p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex items-start gap-3 bg-muted/30 p-3 rounded-xl border border-border/60">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground text-xs">
                          {isRtl ? 'سجّل الدخول بحساب Google' : localSettings.language === 'fr' ? 'Connectez-vous avec Google' : 'Sign in with Google'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isRtl ? 'استخدم بريدك أو حساب Google الشخصي (Gmail).' : localSettings.language === 'fr' ? 'Utilisez votre compte Google ou Gmail standard.' : 'Sign in with your personal Google or Gmail account.'}
                        </p>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex items-start gap-3 bg-muted/30 p-3 rounded-xl border border-border/60">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground text-xs">
                          {isRtl ? 'اضغط على "Create API key"' : localSettings.language === 'fr' ? 'Cliquez sur "Create API key"' : 'Click "Create API key"'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isRtl ? 'اختر مشروعاً جديداً وسيتم إنشاء المفتاح فوراً وبشكل مجاني.' : localSettings.language === 'fr' ? 'Sélectionnez un projet pour générer votre clé gratuitement.' : 'Select a project to generate your free API key instantly.'}
                        </p>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="flex items-start gap-3 bg-muted/30 p-3 rounded-xl border border-border/60">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground text-xs">
                          {isRtl ? 'انسخ المفتاح والصقه هنا' : localSettings.language === 'fr' ? 'Copiez et collez la clé ici' : 'Copy and paste the key here'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isRtl ? 'الصق المفتاح في حقل مفتاح API واضغط زر "اختبار" للتحقق من جاهزيته.' : localSettings.language === 'fr' ? 'Collez la clé dans le champ Clé API et cliquez sur "Tester".' : 'Paste the key into the API key field and click "Test" to verify.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-border flex items-center justify-between gap-3 bg-muted/20">
                  <button
                    type="button"
                    onClick={() => setShowGeminiGuideModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    {isRtl ? 'إغلاق' : localSettings.language === 'fr' ? 'Fermer' : 'Close'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openExternalUrl('https://aistudio.google.com/app/apikey');
                      setShowGeminiGuideModal(false);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <span>{isRtl ? 'الانتقال إلى Google AI Studio' : localSettings.language === 'fr' ? 'Ouvrir Google AI Studio' : 'Open Google AI Studio'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
