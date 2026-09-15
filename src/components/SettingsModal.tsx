import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  useAppStore,
  defaultAiActionPrompts,
  AiActionPrompts,
  QuickActionItem,
  defaultQuickActions,
  defaultGeneralActions,
  LLMProvider,
  Settings,
} from '../store';
import {
  testProviderApiKey,
  getDefaultModelForProvider,
} from '../services/llm';
import {
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

export interface ProviderDefinition {
  id: LLMProvider;
  name: string;
  nameAr: string;
  badge: string;
  badgeAr: string;
  logoDark: string;
  logoLight: string;
  officialKeyUrl: string;
  keyLinkText: string;
  keyLinkTextAr: string;
  keyProp: keyof Settings;
  keyPlaceholder: string;
  keyPlaceholderAr: string;
  defaultModel: string;
  models: { value: string; label: string }[];
  guide: {
    title: string;
    titleAr: string;
    desc: string;
    descAr: string;
    steps: {
      title: string;
      titleAr: string;
      desc: string;
      descAr: string;
    }[];
  };
}

export const PROVIDER_CONFIGS: ProviderDefinition[] = [
  {
    id: 'gemini',
    name: 'Gemini',
    nameAr: 'Gemini',
    badge: 'Free Tier (1500 RPD)',
    badgeAr: 'مجاني (1500 طلب/يوم)',
    logoDark: '/ai-providers/gemini.svg',
    logoLight: '/ai-providers/gemini.svg',
    officialKeyUrl: 'https://aistudio.google.com/app/apikey',
    keyLinkText: 'Get your free Gemini API Key',
    keyLinkTextAr: 'احصل على مفتاح Gemini مجاناً',
    keyProp: 'geminiApiKey',
    keyPlaceholder: 'Enter Gemini key (starts with AIzaSy)',
    keyPlaceholderAr: 'أدخل مفتاح Gemini (يبدأ بـ AIzaSy)',
    defaultModel: 'gemini-2.5-flash',
    models: [
      { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash (Recommended)' },
      { value: 'gemini-2.5-flash-lite', label: 'gemini-2.5-flash-lite' },
      { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
      { value: 'gemini-1.5-pro', label: 'gemini-1.5-pro' },
    ],
    guide: {
      title: 'How to Get a Free Google Gemini API Key',
      titleAr: 'كيفية الحصول على مفتاح Google Gemini مجاني',
      desc: 'Google offers generous free access to Gemini models for personal use (1,500 requests per day) without requiring any credit card.',
      descAr: 'توفر Google وصولاً مجانياً سخياً لنماذج Gemini للاستخدام الشخصي (1500 طلب يومياً) دون الحاجة لبطاقة مصرفية أو دفع مسبق.',
      steps: [
        {
          title: 'Open Google AI Studio',
          titleAr: 'افتح موقع Google AI Studio',
          desc: 'Visit Google AI Studio developer console using the button below.',
          descAr: 'انتقل إلى بوابة مطوري Google AI Studio عبر الزر أدناه.',
        },
        {
          title: 'Sign in with Google',
          titleAr: 'سجّل الدخول بحساب Google',
          desc: 'Use your standard personal Google or Gmail account.',
          descAr: 'استخدم بريدك أو حساب Google الشخصي (Gmail).',
        },
        {
          title: 'Click "Create API key"',
          titleAr: 'اضغط على "Create API key"',
          desc: 'Select an existing Google Cloud project or create a new one with 1 click.',
          descAr: 'اختر مشروعاً جديداً وسيتم توليد المفتاح فوراً وبشكل مجاني تماماً.',
        },
        {
          title: 'Paste and Test in Taqyeed',
          titleAr: 'انسخ المفتاح والصقه في تقييد',
          desc: 'Copy your API key (starts with AIzaSy) and click "Test" to verify.',
          descAr: 'انسخ المفتاح (يبدأ بـ AIzaSy) والصقه هنا واضغط زر "اختبار" للتحقق.',
        },
      ],
    },
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    nameAr: 'OpenRouter',
    badge: 'Free Models Router',
    badgeAr: 'توجيه للنماذج المجانية',
    logoDark: '/ai-providers/openrouter.svg',
    logoLight: '/ai-providers/openrouterb.svg',
    officialKeyUrl: 'https://openrouter.ai/keys',
    keyLinkText: 'Get OpenRouter API Key',
    keyLinkTextAr: 'احصل على مفتاح OpenRouter',
    keyProp: 'openRouterApiKey',
    keyPlaceholder: 'Enter OpenRouter key (starts with sk-or-v1-)',
    keyPlaceholderAr: 'أدخل مفتاح OpenRouter (يبدأ بـ sk-or-v1-)',
    defaultModel: 'openrouter/free',
    models: [
      { value: 'openrouter/free', label: 'openrouter/free (Recommended)' },
      { value: 'google/gemini-2.5-flash', label: 'google/gemini-2.5-flash' },
      { value: 'deepseek/deepseek-chat', label: 'deepseek/deepseek-chat' },
      { value: 'meta-llama/llama-3.3-70b-instruct', label: 'meta-llama/llama-3.3-70b-instruct' },
      { value: 'anthropic/claude-3.5-sonnet', label: 'anthropic/claude-3.5-sonnet' },
    ],
    guide: {
      title: 'How to Get an OpenRouter API Key',
      titleAr: 'كيفية الحصول على مفتاح OpenRouter واستخدام النماذج المجانية',
      desc: 'OpenRouter provides unified access to 100+ AI models. "openrouter/free" auto-routes to available free models dynamically (50 requests/day free).',
      descAr: 'يوفر OpenRouter وصولاً موحداً لأكثر من 100 نموذج. يتيح خيار "openrouter/free" التوجيه التلقائي للنماذج المجانية المتاحة مجاناً (50 طلباً مجانياً يومياً).',
      steps: [
        {
          title: 'Visit OpenRouter Keys',
          titleAr: 'افتح صفحة مفاتيح OpenRouter',
          desc: 'Go to openrouter.ai/keys and sign in using Google, GitHub, or email.',
          descAr: 'توجه إلى openrouter.ai/keys وسجل دخولك عبر Google أو GitHub.',
        },
        {
          title: 'Click "Create Key"',
          titleAr: 'اضغط على زر "Create Key"',
          desc: 'Label the key (e.g. Taqyeed Notes) and leave the credit limit empty or custom.',
          descAr: 'سمّ المفتاح (مثلاً Taqyeed) واترك حد الرصيد فارغاً أو مخصصاً.',
        },
        {
          title: 'Copy the secret key',
          titleAr: 'انسخ المفتاح السري',
          desc: 'Copy the newly generated key starting with sk-or-v1-.',
          descAr: 'انسخ المفتاح الذي تم إنشاؤه ويبدأ بـ sk-or-v1-.',
        },
        {
          title: 'Paste and select openrouter/free',
          titleAr: 'الصق المفتاح واختر openrouter/free',
          desc: 'Paste the key in Taqyeed and select "openrouter/free" for free models auto-routing.',
          descAr: 'الصق المفتاح في تقييد واختر نموذج openrouter/free للاستفادة من التوجيه المجاني.',
        },
      ],
    },
  },
  {
    id: 'qwen',
    name: 'Qwen',
    nameAr: 'Qwen',
    badge: '1M–2M Free Tokens ($0.03/1M)',
    badgeAr: 'رصيد 1M–2M مجاناً (0.03$/1M)',
    logoDark: '/ai-providers/qwen.svg',
    logoLight: '/ai-providers/qwenb.svg',
    officialKeyUrl: 'https://bailian.console.aliyun.com/?apiKey=1',
    keyLinkText: 'Get Qwen (DashScope) API Key',
    keyLinkTextAr: 'احصل على مفتاح Qwen (DashScope)',
    keyProp: 'qwenApiKey',
    keyPlaceholder: 'Enter Qwen key (starts with sk-)',
    keyPlaceholderAr: 'أدخل مفتاح Qwen (يبدأ بـ sk-)',
    defaultModel: 'qwen3.7-flash',
    models: [
      { value: 'qwen3.7-flash', label: 'qwen3.7-flash (Recommended)' },
      { value: 'qwen3.8-flash', label: 'qwen3.8-flash' },
      { value: 'qwen-plus', label: 'qwen-plus' },
      { value: 'qwen-turbo', label: 'qwen-turbo' },
    ],
    guide: {
      title: 'How to Get an Alibaba Qwen (DashScope) API Key',
      titleAr: 'كيفية الحصول على مفتاح Qwen (DashScope) من علي بابا',
      desc: 'Alibaba Cloud provides world-class Qwen models with extraordinary Arabic comprehension and generous free trial credit tokens (1M–2M tokens) for new users ($0.03 In / $0.13 Out).',
      descAr: 'توفر سحابة علي بابا نماذج Qwen الرائدة التي تتفوق في معالجة اللغة العربية وفهم السياق، مع رصيد تجريبي ترحيبي بملايين الرموز المجانية (0.03$ لكل مليون رمز إدخال).',
      steps: [
        {
          title: 'Open Alibaba Model Studio (Bailian)',
          titleAr: 'افتح منصة Alibaba Model Studio',
          desc: 'Visit bailian.console.aliyun.com and sign in to your Alibaba Cloud account.',
          descAr: 'توجه إلى bailian.console.aliyun.com وسجل دخولك إلى Alibaba Cloud.',
        },
        {
          title: 'Go to API-KEY management',
          titleAr: 'انتقل إلى إدارة API-KEY',
          desc: 'Click on the API-KEY icon in the top header or sidebar.',
          descAr: 'اضغط على أيقونة أو خيار API-KEY في الشريط العلوي أو الجانبي.',
        },
        {
          title: 'Create new API-KEY',
          titleAr: 'أنشئ مفتاحاً جديداً (新建 API-KEY)',
          desc: 'Click "Create new API-KEY" and copy the generated secret key.',
          descAr: 'اضغط على زر "新建 API-KEY" وانسخ المفتاح الذي تم إنشاؤه.',
        },
        {
          title: 'Paste and Test in Taqyeed',
          titleAr: 'الصق المفتاح واختبره',
          desc: 'Paste your key (starts with sk-) into Taqyeed and test connection.',
          descAr: 'الصق المفتاح في تقييد واضغط زر الاختبار للتأكد من اتصاله بنجاح.',
        },
      ],
    },
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    nameAr: 'DeepSeek',
    badge: 'Prompt Caching ($0.15/1M)',
    badgeAr: 'تخزين مؤقت للرموز (0.15$/1M)',
    logoDark: '/ai-providers/deepseek.svg',
    logoLight: '/ai-providers/deepseek.svg',
    officialKeyUrl: 'https://platform.deepseek.com/api_keys',
    keyLinkText: 'Get DeepSeek API Key',
    keyLinkTextAr: 'احصل على مفتاح DeepSeek',
    keyProp: 'deepseekApiKey',
    keyPlaceholder: 'Enter DeepSeek key (starts with sk-)',
    keyPlaceholderAr: 'أدخل مفتاح DeepSeek (يبدأ بـ sk-)',
    defaultModel: 'deepseek-flash',
    models: [
      { value: 'deepseek-flash', label: 'deepseek-flash (Routes to V4.1 with Cache - Recommended)' },
      { value: 'deepseek-chat', label: 'deepseek-chat (DeepSeek-V3)' },
      { value: 'deepseek-reasoner', label: 'deepseek-reasoner (DeepSeek-R1)' },
    ],
    guide: {
      title: 'How to Get a DeepSeek API Key',
      titleAr: 'كيفية الحصول على مفتاح DeepSeek',
      desc: 'DeepSeek delivers cutting-edge performance at ultra-low pricing ($0.15/1M in, cache hits drop to $0.003/1M). Routes directly to optimized endpoints.',
      descAr: 'يقدم DeepSeek أداءً منافساً لأقوى النماذج وبأرخص سعر رمزي في العالم (0.15$ لكل مليون رمز، وتنخفض مع التخزين المؤقت إلى 0.003$).',
      steps: [
        {
          title: 'Open DeepSeek Platform',
          titleAr: 'افتح منصة DeepSeek',
          desc: 'Go to platform.deepseek.com and register with email or phone number.',
          descAr: 'توجه إلى platform.deepseek.com وسجل حسابك بالبريد أو رقم الهاتف.',
        },
        {
          title: 'Navigate to API Keys',
          titleAr: 'انتقل إلى قسم API Keys',
          desc: 'In the left navigation menu, click on "API keys".',
          descAr: 'في القائمة الجانبية اليسرى اضغط على "API keys".',
        },
        {
          title: 'Create a new key',
          titleAr: 'أنشئ مفتاحاً جديداً',
          desc: 'Click "Create API key", enter a name, and generate the secret key.',
          descAr: 'اضغط على "Create API key" وأدخل اسماً ثم أنشئ المفتاح.',
        },
        {
          title: 'Copy and paste into Taqyeed',
          titleAr: 'انسخ المفتاح والصقه في تقييد',
          desc: 'Copy the key starting with sk- and paste it into Taqyeed settings.',
          descAr: 'انسخ المفتاح (يبدأ بـ sk-) والصقه هنا واختبر جاهزيته فوراً.',
        },
      ],
    },
  },
  {
    id: 'kimi',
    name: 'Kimi',
    nameAr: 'Kimi',
    badge: '128k Context + Free Quota',
    badgeAr: 'سياق 128k ورصيد ترحيبي',
    logoDark: '/ai-providers/kimi.svg',
    logoLight: '/ai-providers/kimi.svg',
    officialKeyUrl: 'https://platform.moonshot.ai/console/api-keys',
    keyLinkText: 'Get Kimi (Moonshot) API Key',
    keyLinkTextAr: 'احصل على مفتاح Kimi (Moonshot)',
    keyProp: 'kimiApiKey',
    keyPlaceholder: 'Enter Moonshot/Kimi key (starts with sk-)',
    keyPlaceholderAr: 'أدخل مفتاح Kimi (يبدأ بـ sk-)',
    defaultModel: 'kimi-k2.6',
    models: [
      { value: 'kimi-k2.6', label: 'kimi-k2.6 (Recommended)' },
      { value: 'kimi-k3', label: 'kimi-k3 (Flagship Intelligence)' },
      { value: 'moonshot-v1-8k', label: 'moonshot-v1-8k' },
      { value: 'moonshot-v1-32k', label: 'moonshot-v1-32k' },
      { value: 'moonshot-v1-128k', label: 'moonshot-v1-128k (Long Context)' },
    ],
    guide: {
      title: 'How to Get a Kimi (Moonshot AI) API Key',
      titleAr: 'كيفية الحصول على مفتاح Kimi (Moonshot AI)',
      desc: 'Moonshot AI\'s Kimi specializes in long document processing and high context windows (up to 128k tokens), granting free trial quota upon registration.',
      descAr: 'تتميز نماذج Kimi من Moonshot بقدرتها الفائقة على قراءة وتلخيص الوثائق الطويلة بسياق يصل لـ 128 ألف رمز، مع منح رصيد تجريبي مجاني عند إنشاء الحساب.',
      steps: [
        {
          title: 'Open Moonshot Open Platform',
          titleAr: 'افتح منصة Moonshot',
          desc: 'Visit platform.moonshot.ai and register with your email or phone.',
          descAr: 'توجه إلى platform.moonshot.ai وسجل حسابك بالبريد أو رقم الهاتف.',
        },
        {
          title: 'Open API Keys section',
          titleAr: 'انتقل إلى إدارة المفاتيح API Keys',
          desc: 'Click on "API Keys" (API Key 管理) from the left sidebar.',
          descAr: 'اضغط على "API Keys" من القائمة الجانبية.',
        },
        {
          title: 'Click "Create New API Key"',
          titleAr: 'أنشئ مفتاحاً جديداً (新建)',
          desc: 'Click "新建" (Create) and copy the generated secret key.',
          descAr: 'اضغط على زر الإنشاء "新建" وانسخ المفتاح المولد فوراً.',
        },
        {
          title: 'Paste into Taqyeed',
          titleAr: 'الصق المفتاح في تقييد',
          desc: 'Paste your key (starts with sk-) into Taqyeed and verify connection.',
          descAr: 'الصق المفتاح في إعدادات تقييد واستمتع بمعالجة النصوص الطويلة.',
        },
      ],
    },
  },
  {
    id: 'grok',
    name: 'Grok',
    nameAr: 'Grok',
    badge: 'Testing Credits ($25/mo)',
    badgeAr: 'رصيد تجريبي (25$ شهرياً)',
    logoDark: '/ai-providers/grok.svg',
    logoLight: '/ai-providers/grokb.svg',
    officialKeyUrl: 'https://console.x.ai/',
    keyLinkText: 'Get xAI Grok API Key',
    keyLinkTextAr: 'احصل على مفتاح xAI Grok',
    keyProp: 'grokApiKey',
    keyPlaceholder: 'Enter xAI key (starts with xai-)',
    keyPlaceholderAr: 'أدخل مفتاح xAI (يبدأ بـ xai-)',
    defaultModel: 'grok-code-fast-1',
    models: [
      { value: 'grok-code-fast-1', label: 'grok-code-fast-1 (Recommended)' },
      { value: 'grok-4.6', label: 'grok-4.6' },
      { value: 'grok-beta', label: 'grok-beta' },
    ],
    guide: {
      title: 'How to Get an xAI Grok API Key',
      titleAr: 'كيفية الحصول على مفتاح xAI Grok',
      desc: 'xAI provides real-time world understanding and deep reasoning. Developer accounts frequently receive $25 monthly testing credits on the console.',
      descAr: 'يوفر نموذج Grok من xAI استدلالاً سريعاً ومعرفة حية. وتحصل حسابات المطورين على رصيد تجريبي بقيمة 25 دولاراً شهرياً لاختبار النماذج.',
      steps: [
        {
          title: 'Open xAI Console',
          titleAr: 'افتح وحدة تحكم xAI',
          desc: 'Visit console.x.ai and sign in with your X (Twitter) or Google account.',
          descAr: 'توجه إلى console.x.ai وسجل دخولك بحسابك في X أو Google.',
        },
        {
          title: 'Go to API Keys',
          titleAr: 'انتقل إلى صفحة API Keys',
          desc: 'From the navigation menu, select "API Keys".',
          descAr: 'من القائمة الجانبية، اختر "API Keys".',
        },
        {
          title: 'Create Key',
          titleAr: 'أنشئ مفتاحاً جديداً',
          desc: 'Click "Create API Key", set permissions, and copy the secret key.',
          descAr: 'اضغط على "Create API Key" وحدد الصلاحيات وانسخ المفتاح فوراً.',
        },
        {
          title: 'Paste and Test in Taqyeed',
          titleAr: 'الصق المفتاح واختبره',
          desc: 'Paste your key (starts with xai-) and click "Test" to verify.',
          descAr: 'الصق المفتاح (يبدأ بـ xai-) في تقييد واضغط زر الاختبار للتأكد من جاهزيته.',
        },
      ],
    },
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    nameAr: 'ChatGPT',
    badge: 'Pay-as-you-go',
    badgeAr: 'دفع حسب الاستخدام',
    logoDark: '/ai-providers/chatgpt.svg',
    logoLight: '/ai-providers/chatgptb.svg',
    officialKeyUrl: 'https://platform.openai.com/api-keys',
    keyLinkText: 'Get OpenAI API Key',
    keyLinkTextAr: 'احصل على مفتاح OpenAI',
    keyProp: 'chatgptApiKey',
    keyPlaceholder: 'Enter OpenAI key (starts with sk-proj- or sk-)',
    keyPlaceholderAr: 'أدخل مفتاح OpenAI (يبدأ بـ sk-proj- أو sk-)',
    defaultModel: 'gpt-4o-mini',
    models: [
      { value: 'gpt-4o-mini', label: 'gpt-4o-mini (Recommended)' },
      { value: 'gpt-4o', label: 'gpt-4o' },
      { value: 'o3-mini', label: 'o3-mini' },
      { value: 'o1-mini', label: 'o1-mini' },
    ],
    guide: {
      title: 'How to Get an OpenAI API Key',
      titleAr: 'كيفية الحصول على مفتاح OpenAI (ChatGPT)',
      desc: 'OpenAI provides the world-renowned GPT model family. "gpt-4o-mini" offers extraordinary speed and low pricing (~$0.15/1M in). Requires an active credit balance ($5 min).',
      descAr: 'توفر OpenAI عائلة نماذج GPT الشهيرة. ويعد نموذج gpt-4o-mini فائق السرعة والاقتصاد (~0.15 دولار لكل مليون رمز). يتطلب إضافة رصيد مسبق الدفع (5$ كحد أدنى).',
      steps: [
        {
          title: 'Open OpenAI Developer Platform',
          titleAr: 'افتح منصة مطوري OpenAI',
          desc: 'Visit platform.openai.com/api-keys and log in to your account.',
          descAr: 'توجه إلى platform.openai.com/api-keys وسجل الدخول لحسابك.',
        },
        {
          title: 'Create new secret key',
          titleAr: 'أنشئ مفتاحاً سرياً جديداً',
          desc: 'Click "Create new secret key", name it (e.g. Taqyeed Notes), and copy it immediately.',
          descAr: 'اضغط على "Create new secret key"، وسمّ المفتاح ثم انسخه فور ظهوره.',
        },
        {
          title: 'Check Billing Balance',
          titleAr: 'تحقق من رصيد الفوترة',
          desc: 'Ensure you have added prepaid credits under Settings → Billing.',
          descAr: 'تأكد من شحن حسابك بمبلغ بسيط تحت قسم Settings → Billing.',
        },
        {
          title: 'Paste and Test in Taqyeed',
          titleAr: 'الصق المفتاح في تقييد',
          desc: 'Paste the key (starts with sk-proj- or sk-) and click "Test".',
          descAr: 'الصق المفتاح واضغط "اختبار" للتأكد من تفعيله بنجاح.',
        },
      ],
    },
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    nameAr: 'Anthropic',
    badge: 'Premium Quality',
    badgeAr: 'جودة أكاديمية فائقة',
    logoDark: '/ai-providers/claude.svg',
    logoLight: '/ai-providers/claude.svg',
    officialKeyUrl: 'https://console.anthropic.com/settings/keys',
    keyLinkText: 'Get Anthropic API Key',
    keyLinkTextAr: 'احصل على مفتاح Anthropic Claude',
    keyProp: 'anthropicApiKey',
    keyPlaceholder: 'Enter Claude key (starts with sk-ant-)',
    keyPlaceholderAr: 'أدخل مفتاح Claude (يبدأ بـ sk-ant-)',
    defaultModel: 'claude-3-5-haiku-20241022',
    models: [
      { value: 'claude-3-5-haiku-20241022', label: 'claude-3-5-haiku (Recommended)' },
      { value: 'claude-3-5-sonnet-20241022', label: 'claude-3-5-sonnet' },
      { value: 'claude-3-haiku-20240307', label: 'claude-3-haiku' },
    ],
    guide: {
      title: 'How to Get an Anthropic Claude API Key',
      titleAr: 'كيفية الحصول على مفتاح Anthropic Claude',
      desc: 'Anthropic Claude models excel at scholarly prose, formatting, and careful instruction-following. "claude-3-5-haiku" delivers high speed and low cost. Requires prepaid credits ($5 min).',
      descAr: 'تتفوق نماذج Claude في الصياغة الأكاديمية والترتيب اللغوي الدقيق. ويوفر نموذج claude-3-5-haiku سرعة عالية وتكلفة مناسبة جداً. يتطلب رصيداً مدفوعاً مسبقاً (5$).',
      steps: [
        {
          title: 'Open Anthropic Console',
          titleAr: 'افتح منصة Anthropic',
          desc: 'Visit console.anthropic.com and sign in to your Anthropic account.',
          descAr: 'توجه إلى console.anthropic.com وسجل دخولك.',
        },
        {
          title: 'Navigate to API Keys',
          titleAr: 'انتقل إلى إعدادات المفاتيح',
          desc: 'Go to Settings → API Keys from the console navigation.',
          descAr: 'انتقل إلى Settings ثم API Keys من القائمة.',
        },
        {
          title: 'Create Key',
          titleAr: 'أنشئ مفتاحاً جديداً',
          desc: 'Click "Create Key", give it a name, and copy the secret key.',
          descAr: 'اضغط على "Create Key" وانسخ المفتاح الذي يبدأ بـ sk-ant-.',
        },
        {
          title: 'Paste and Test in Taqyeed',
          titleAr: 'الصق المفتاح واختبره',
          desc: 'Paste your key into Taqyeed settings and click "Test" to verify.',
          descAr: 'الصق المفتاح في تقييد واضغط زر "اختبار" للتحقق من الصلاحية.',
        },
      ],
    },
  },
  {
    id: 'custom',
    name: 'Custom',
    nameAr: 'خادم مخصص',
    badge: 'OpenAI-Compatible',
    badgeAr: 'متوافق مع OpenAI',
    logoDark: '/ai-providers/custom.svg',
    logoLight: '/ai-providers/customb.svg',
    officialKeyUrl: '',
    keyLinkText: 'OpenAI Protocol Spec',
    keyLinkTextAr: 'مواصفات بروتوكول OpenAI',
    keyProp: 'customApiKey',
    keyPlaceholder: 'Enter API Key / Bearer Token (optional for local models)',
    keyPlaceholderAr: 'أدخل مفتاح API أو رمز Bearer (اختياري للنماذج المحلية)',
    defaultModel: 'default',
    models: [
      { value: 'default', label: 'default (Custom Model)' },
      { value: 'llama3', label: 'llama3' },
      { value: 'llama3.2', label: 'llama3.2' },
      { value: 'mistral', label: 'mistral' },
      { value: 'qwen2.5', label: 'qwen2.5' },
      { value: 'deepseek-r1', label: 'deepseek-r1' },
    ],
    guide: {
      title: 'How to Connect Any Custom / Local AI Server',
      titleAr: 'كيفية ربط أي خادم ذكاء اصطناعي محلي أو مخصص',
      desc: 'Connect Taqyeed to any OpenAI-compatible server such as Ollama, LM Studio, vLLM, LocalAI, Jan, FastChat, or private cloud proxies.',
      descAr: 'اربط تطبيق تقييد بأي خادم متوافق مع معيار OpenAI مثل Ollama أو LM Studio أو vLLM أو LocalAI أو Jan أو أي وكيل سحابي خاص.',
      steps: [
        {
          title: 'Set the Base URL',
          titleAr: 'اضبط رابط الخادم (Base URL)',
          desc: 'Enter your server address, e.g. http://localhost:11434/v1 (Ollama), http://localhost:1234/v1 (LM Studio), or your remote proxy endpoint.',
          descAr: 'أدخل عنوان خادمك مثل http://localhost:11434/v1 (Ollama) أو http://localhost:1234/v1 (LM Studio) أو رابط وكيلك السحابي.',
        },
        {
          title: 'Enter API Key (Optional)',
          titleAr: 'أدخل مفتاح API (اختياري)',
          desc: 'If your server requires authentication, enter the Bearer Token or API key. For local instances without auth, you can leave it blank.',
          descAr: 'إذا كان خادمك يطلب مصادقة، أدخل الرمز. للنماذج المحلية بدون حماية، يمكنك تركه فارغاً.',
        },
        {
          title: 'Select or Type Model Name',
          titleAr: 'اختر أو اكتب اسم النموذج',
          desc: 'Choose from common tags or select "Other" to enter your exact model identifier (e.g., llama3:8b, mistral-7b).',
          descAr: 'اختر من القائمة أو حدد "أخرى" لكتابة اسم النموذج المحمّل في خادمك بدقة (مثل llama3:8b).',
        },
        {
          title: 'Test Connection',
          titleAr: 'اختبر الاتصال',
          desc: 'Click "Test" to verify connectivity between Taqyeed and your custom endpoint.',
          descAr: 'اضغط زر "اختبار" للتأكد من وصول تقييد إلى خادمك بنجاح.',
        },
      ],
    },
  },
  {
    id: 'sidecar',
    name: 'Taqyeed Gate',
    nameAr: 'بوابة تقييد (محلي)',
    badge: 'Local / Offline',
    badgeAr: 'محلي دون إنترنت',
    logoDark: '',
    logoLight: '',
    officialKeyUrl: 'http://127.0.0.1:47195/health',
    keyLinkText: 'Check Local Daemon Status',
    keyLinkTextAr: 'فحص حالة الخادم المحلي',
    keyProp: 'sidecarUrl',
    keyPlaceholder: 'http://127.0.0.1:47195',
    keyPlaceholderAr: 'http://127.0.0.1:47195',
    defaultModel: 'gemini-flash',
    models: [
      { value: 'gemini-flash', label: 'gemini-flash (Local)' },
      { value: 'gemini-flash-lite', label: 'gemini-flash-lite (Local)' },
      { value: 'gemini-pro', label: 'gemini-pro (Local)' },
    ],
    guide: {
      title: 'How to Connect Taqyeed Gate Local Daemon',
      titleAr: 'كيفية ربط بوابة تقييد المحلية',
      desc: 'Taqyeed Gate runs locally on your PC on port 47195, processing audio and text privately without needing external API keys.',
      descAr: 'تعمل بوابة تقييد محلياً على حاسوبك على المنفذ 47195 لمعالجة الصوت والنصوص بخصوصية تامة ودون الحاجة لمفاتيح API خارجية.',
      steps: [
        {
          title: 'Launch Taqyeed Gate',
          titleAr: 'شغّل بوابة تقييد',
          desc: 'Run the Taqyeed Gate background service or application on your computer.',
          descAr: 'شغّل برنامج أو خدمة بوابة تقييد الخلفية على جهازك.',
        },
        {
          title: 'Confirm sidecar URL',
          titleAr: 'تأكد من عنوان الرابط',
          desc: 'Ensure the sidecar URL is set to http://127.0.0.1:47195.',
          descAr: 'تأكد من أن الرابط مضبوط على http://127.0.0.1:47195.',
        },
        {
          title: 'Test connection',
          titleAr: 'اختبر الاتصال',
          desc: 'Click "Test" to verify local communication with the daemon.',
          descAr: 'اضغط على زر "اختبار" للتأكد من استجابة الخادم المحلي.',
        },
        {
          title: 'Ready for offline usage',
          titleAr: 'جاهز للاستخدام',
          desc: 'Audio recordings and notes will be processed privately via local models.',
          descAr: 'سيتم تلخيص التسجيلات والملاحظات عبر النماذج المحلية بخصوصية تامة.',
        },
      ],
    },
  },
];

export function SettingsScreen() {
  const { settings, updateSettings, activeNoteId, isNoteOpen, setActiveScreen } = useAppStore();
  const t = translations[settings.language] || translations.ar;
  const isRtl = settings.language === 'ar';

  const [localSettings, setLocalSettings] = useState(settings);
  const { showToast } = useToast();

  const isDarkTheme =
    localSettings.theme === 'dark' ||
    (localSettings.theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

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

  // Provider configurations
  const activeProviderConfig = PROVIDER_CONFIGS.find(p => p.id === localSettings.llmProvider) || PROVIDER_CONFIGS[0];

  const providerIcon = isDarkTheme
    ? (activeProviderConfig.logoDark || undefined)
    : (activeProviderConfig.logoLight || undefined);

  const activeModelPresets = [
    ...activeProviderConfig.models.map(m => ({
      ...m,
      image: providerIcon,
    })),
    { value: 'other', label: isRtl ? 'أخرى (نموذج مخصص)' : 'Other (Custom model)' },
  ];

  const isCurrentModelPreset = activeModelPresets.some(p => p.value !== 'other' && p.value === localSettings.llmModel);
  const [isCustomModelMode, setIsCustomModelMode] = useState<boolean>(!isCurrentModelPreset);

  // API Key show/hide and testing state
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestStatus, setKeyTestStatus] = useState<'valid' | 'invalid' | null>(null);
  const [guideModalProvider, setGuideModalProvider] = useState<LLMProvider | null>(null);

  const handleTestApiKey = async () => {
    const provider = localSettings.llmProvider;
    const config = PROVIDER_CONFIGS.find(p => p.id === provider) || PROVIDER_CONFIGS[0];
    const key = (localSettings[config.keyProp as keyof Settings] as string) || '';

    if (provider === 'custom') {
      if (!localSettings.customApiBaseUrl?.trim()) {
        showToast(isRtl ? 'يرجى إدخال رابط الخادم (Base URL) أولاً للاختبار' : 'Please enter the Base URL first to test', 'error');
        return;
      }
    } else if (!key && provider !== 'sidecar') {
      showToast(isRtl ? 'يرجى إدخال مفتاح API أولاً للاختبار' : 'Please enter an API key first to test', 'error');
      return;
    }

    setIsTestingKey(true);
    setKeyTestStatus(null);

    try {
      const res = await testProviderApiKey(provider, key, localSettings.customApiBaseUrl);
      if (res.success) {
        setKeyTestStatus('valid');
        showToast(isRtl ? 'المفتاح صالح والاتصال ناجح!' : `${config.name} API Key is valid and working!`, 'success');
      } else {
        setKeyTestStatus('invalid');
        showToast(res.message || (isRtl ? 'المفتاح غير صالح أو الاتصال فشل' : 'Invalid API key or connection failed'), 'error');
      }
    } catch (err: any) {
      setKeyTestStatus('invalid');
      showToast(err.message || (isRtl ? 'فشل اختبار الاتصال' : 'Connection test failed'), 'error');
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

  const providerOptions = PROVIDER_CONFIGS.map(p => ({
    value: p.id,
    label: isRtl ? p.nameAr : p.name,
    image: isDarkTheme ? (p.logoDark || undefined) : (p.logoLight || undefined),
  }));

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
                    <label className="block text-sm font-semibold text-foreground mb-1.5">
                      {isRtl ? 'لغة التطبيق' : 'App Language'}
                    </label>
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
                  {/* Provider Selection */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{t.llmProvider}</label>
                    <CustomSelect
                      size="lg"
                      value={localSettings.llmProvider}
                      options={providerOptions}
                      onChange={(val) => {
                        const newProvider = val as LLMProvider;
                        const def = PROVIDER_CONFIGS.find((p) => p.id === newProvider);
                        const newModel = def?.defaultModel || getDefaultModelForProvider(newProvider);
                        const updated = { ...localSettings, llmProvider: newProvider, llmModel: newModel };
                        setLocalSettings(updated);
                        updateSettings({ llmProvider: newProvider, llmModel: newModel });
                        setIsCustomModelMode(false);
                        setKeyTestStatus(null);
                      }}
                    />
                  </div>

                  {/* API KEY INPUT & BASE URL / SIDECAR CONFIG */}
                  {localSettings.llmProvider !== 'sidecar' ? (
                    <div className="space-y-3">
                      {/* BASE URL INPUT FOR CUSTOM PROVIDER */}
                      {localSettings.llmProvider === 'custom' && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-sm font-medium text-foreground">
                              {isRtl ? 'رابط الخادم المخصص (Base URL)' : 'Base URL'} <span className="text-destructive">*</span>
                            </label>
                            <span className="text-xs text-muted-foreground font-mono">
                              {isRtl ? 'مثال: http://localhost:11434/v1' : 'e.g. http://localhost:11434/v1'}
                            </span>
                          </div>
                          <input
                            type="url"
                            className="w-full border border-border bg-background rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow font-mono"
                            value={localSettings.customApiBaseUrl || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setKeyTestStatus(null);
                              setLocalSettings({ ...localSettings, customApiBaseUrl: val });
                              updateSettings({ customApiBaseUrl: val });
                            }}
                            placeholder="http://localhost:11434/v1"
                          />
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {isRtl
                              ? 'يدعم خوادم Ollama و LM Studio و vLLM و LocalAI وأي وكيل متوافق مع /v1/chat/completions.'
                              : 'Supports Ollama, LM Studio, vLLM, LocalAI, and any /v1/chat/completions proxy.'}
                          </p>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-sm font-medium text-foreground">
                            {t.apiKey} <span className="text-xs text-muted-foreground font-normal">({activeProviderConfig.name})</span>
                          </label>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {isRtl ? activeProviderConfig.badgeAr : activeProviderConfig.badge}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1 flex items-center">
                            <input
                              type={showApiKey ? 'text' : 'password'}
                              autoComplete="new-password"
                              className="w-full border border-border bg-background rounded-lg p-2.5 pe-10 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow font-mono"
                              value={(localSettings[activeProviderConfig.keyProp as keyof Settings] as string) || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setKeyTestStatus(null);
                                setLocalSettings({ ...localSettings, [activeProviderConfig.keyProp]: val });
                                updateSettings({ [activeProviderConfig.keyProp]: val });
                              }}
                              placeholder={
                                isRtl
                                  ? activeProviderConfig.keyPlaceholderAr
                                  : activeProviderConfig.keyPlaceholder
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
                            title={isRtl ? 'اختبار صلاحية الاتصال' : 'Test connection validity'}
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

                        {/* Official API key link & (i) authentic guide modal button */}
                        <div className="flex items-center justify-between text-xs mt-2 px-0.5">
                          {activeProviderConfig.officialKeyUrl ? (
                            <button
                              type="button"
                              onClick={() => openExternalUrl(activeProviderConfig.officialKeyUrl)}
                              className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium cursor-pointer"
                            >
                              <span>{isRtl ? activeProviderConfig.keyLinkTextAr : activeProviderConfig.keyLinkText}</span>
                              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {isRtl ? 'مفتاح API اختياري للنماذج المحلية' : 'API key is optional for local models'}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setGuideModalProvider(localSettings.llmProvider)}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title={isRtl ? 'شرح كيفية الإعداد والربط' : 'How to set up and connect'}
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        {isRtl ? 'عنوان خادم تقييد المحلي' : 'Taqyeed Gate URL'}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          className="w-full border border-border bg-background rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow font-mono"
                          value={localSettings.sidecarUrl || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLocalSettings({ ...localSettings, sidecarUrl: val });
                            updateSettings({ sidecarUrl: val });
                          }}
                          placeholder="http://127.0.0.1:47195"
                        />
                        <button
                          type="button"
                          onClick={handleTestApiKey}
                          disabled={isTestingKey}
                          className="px-3.5 py-2.5 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isTestingKey ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : keyTestStatus === 'valid' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : keyTestStatus === 'invalid' ? (
                            <AlertCircle className="w-4 h-4 text-destructive" />
                          ) : null}
                          <span>{t.testApiKey || (isRtl ? 'اختبار' : 'Test')}</span>
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-xs mt-2 px-0.5">
                        <button
                          type="button"
                          onClick={() => openExternalUrl('http://127.0.0.1:47195/health')}
                          className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium cursor-pointer"
                        >
                          <span>{isRtl ? 'فحص حالة الخادم المحلي' : 'Check Local Daemon Status'}</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setGuideModalProvider('sidecar')}
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Model Preset Selection */}
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
                          setLocalSettings((prev) => ({ ...prev, llmModel: val }));
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
                            setLocalSettings((prev) => ({ ...prev, llmModel: val }));
                            updateSettings({ llmModel: val });
                          }}
                          placeholder={activeProviderConfig.defaultModel}
                          autoFocus
                        />
                      </div>
                    )}
                  </div>
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
                  <div className="flex items-center gap-3.5 sm:gap-4 pb-4 border-b border-border/60">
                    <img
                      src="/logo.svg"
                      alt="Taqyeed AI Logo"
                      className="w-14 h-14 sm:w-16 sm:h-16 object-contain shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                          {t.appName}
                        </h4>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                          v1.0.0
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                          MIT License
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">
                        {isRtl
                          ? 'تم تطوير هذا المشروع من طرف عقبة بوبكر - الجزائر'
                          : 'This project was made by Boubakeur Okba - Algeria'}
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

        <div className="pb-12 md:pb-6" />

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

          {/* Dynamic Authentic Provider API Key Guide Overlay Modal */}
          {guideModalProvider && (() => {
            const guideDef = PROVIDER_CONFIGS.find((p) => p.id === guideModalProvider) || PROVIDER_CONFIGS[0];
            const guideLogo = isDarkTheme ? guideDef.logoDark : guideDef.logoLight;
            return (
              <div
                className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
                onClick={() => setGuideModalProvider(null)}
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
                    <div className="flex items-center gap-2.5">
                      {guideLogo ? (
                        <img src={guideLogo} alt="" className="w-5 h-5 object-contain" />
                      ) : (
                        <div className="p-1.5 bg-muted rounded-lg text-foreground">
                          <Sparkles className="w-4 h-4" />
                        </div>
                      )}
                      <h3 className="text-sm font-bold text-foreground">
                        {isRtl ? guideDef.guide.titleAr : guideDef.guide.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGuideModalProvider(null)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-5 overflow-y-auto space-y-4 text-sm max-h-[75vh]">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {isRtl ? guideDef.guide.descAr : guideDef.guide.desc}
                    </p>

                    <div className="space-y-2.5 pt-1">
                      {guideDef.guide.steps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3 bg-muted/30 p-3 rounded-xl border border-border/60">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                            {idx + 1}
                          </span>
                          <div className="space-y-0.5">
                            <p className="font-semibold text-foreground text-xs">
                              {isRtl ? step.titleAr : step.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {isRtl ? step.descAr : step.desc}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 border-t border-border flex items-center justify-between gap-3 bg-muted/20">
                    <button
                      type="button"
                      onClick={() => setGuideModalProvider(null)}
                      className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      {isRtl ? 'إغلاق' : localSettings.language === 'fr' ? 'Fermer' : 'Close'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        openExternalUrl(guideDef.officialKeyUrl);
                        setGuideModalProvider(null);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span>{isRtl ? guideDef.keyLinkTextAr : guideDef.keyLinkText}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              </div>
            );
          })()}
        </AnimatePresence>
      </div>
    </div>
  );
}
