<div align="center">
  <img src="docs/images/logo.jpg" alt="AI Skills Hub Logo" width="300" />
  <h1>AI Skills Hub</h1>
  <p><strong>كل ما يحتاجه الذكاء الاصطناعي الخاص بك للبرمجة.. في مكان واحد.</strong></p>
  
  <p>
    <a href="https://github.com/AxiomNode-lab/AI-Skills-Hub/actions"><img src="https://img.shields.io/github/actions/workflow/status/AxiomNode-lab/AI-Skills-Hub/ci.yml?branch=main&label=Build&style=flat-square" alt="Build Status"></a>
    <a href="https://github.com/AxiomNode-lab/AI-Skills-Hub/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License: MIT"></a>
  </p>
</div>

---

## ما هو AI Skills Hub؟

كمبرمج، أنت تبحث دائماً عن أدوات ومهارات لتطوير برمجياتك بمساعدة الذكاء الاصطناعي. بدلاً من البحث كل يوم عن أداة جديدة أو مهارة معينة (Skills) أو خادم (MCP Server) لربط الذكاء الاصطناعي بقواعد البيانات أو GitHub... **لقد جمعنا لك كل شيء هنا.**

هذا المشروع هو عبارة عن **متجر متكامل (Package Manager)**. بنقرة واحدة من التيرمينال، يمكنك تزويد المساعد الذكي الخاص بك (مثل Claude Desktop أو Cursor أو أي Agent آخر) بأفضل المهارات المبرمجة مسبقاً من مجتمع المطورين.

## المميزات الأساسية
- **مكتبة ضخمة:** يحتوي على أكثر من 50 مهارة وأداة MCP جاهزة (من قواعد بيانات، أدوات SEO، اتصال بـ Github وغيرها).
- **سهل ومُنظم:** كل شيء منظم في مجلدات (Skills للقدرات البرمجية، و MCP للربط مع الخدمات).
- **يعمل من التيرمينال:** واجهة تيرمينال أنيقة وجميلة تسمح لك بتصفح وتثبيت المهارات بضغطة زر.
- **تحديث ذاتي:** يجلب آخر التحديثات والأكواد من المطورين الأصليين مباشرة.

## كيف تستخدمه؟

فقط قم بتشغيل هذا الأمر في التيرمينال، وستفتح لك واجهة أنيقة تتيح لك اختيار المهارات التي تريد تثبيتها:

```bash
node packages/cli/bin/skills-hub.mjs
```

للاختيار، استخدم المسطرة `Space`، ولتأكيد التثبيت اضغط `Enter`. 

## الهيكلة (للمطورين)
قمنا بترتيب المشروع ليكون نظيفاً جداً من الداخل:
- `capabilities-library/mcp-servers/`: خوادم الـ MCP للاتصال الخارجي.
- `capabilities-library/agent-skills/`: المهارات والتعليمات التي تجعل الـ Agent مبرمجاً أفضل.

إذا كنت تريد إضافة مهارة، فقط أضف مجلدها هنا وسيتعرف عليها النظام تلقائياً!

## المساهمة
نحن نرحب بإضافة المزيد من المهارات للمستودع! راجع `CONTRIBUTING.md` لمزيد من التفاصيل.
