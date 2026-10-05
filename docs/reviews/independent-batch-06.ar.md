# المراجعة المستقلة — الدفعة 6: خمس مهارات من microsoft/skills

تاريخ المراجعة: 2026-10-05. تغطي هذه الدفعة **خمس مهارات فقط** كانت eligible وما زالت بلا independent-batch إضافي قبل هذه المراجعة. التفاصيل القابلة للمعالجة آليًا موجودة في [independent-batch-06.json](independent-batch-06.json).

هذه مراجعة AI-assisted للملفات والتعليمات وليست اختبار أداء، أو رأيًا قانونيًا، أو شهادة أمنية بشرية. كما أن نجاح install/build — إن حدث في CI — لا يثبت أن workflow ينجز المهمة فعليًا.

## التحقق من المصدر والترخيص

المصدر المثبت هو `microsoft/skills@84d8eaa8ae95930f55cdceb3e27196c795dab038`. الشجرة recursive غير truncated، وكل skill subtree من الخمس يحتوي upstream على `SKILL.md` واحد فقط بوضع `100644`. تطابقت Git blob والـbytes مع الملفات الموزعة، وتطابقت SHA-256 المسجلة بين review والmanifest. `LICENSE.txt` هو نفس MIT root blob (1140 bytes)، ولم يوجد LICENSE/COPYING/NOTICE override على مسار أي مهارة.

تعذر تشغيل `git` محليًا ضد GitHub لأن container لا يستطيع resolve `github.com`. لذلك لا نسجل local verify-upstream ناجحًا؛ يجب الاعتماد على نتيجة `verify-upstream` في CI النهائي.

## القرارات والأدلة

| المهارة | القرار | الأدلة المهمة |
| --- | --- | --- |
| `microsoft/azure-eventhub-rust` | release / يبقى eligible | `SKILL.md:28` يثبت crates بشكل unpinned. أمثلة `:80` و`:86-90` ترسل event/batch فعليًا إذا شغّلها المستخدم. `:123-146` تستقبل وتطبع event body؛ payload قد يكون حساسًا حتى لو لم يكن credential. |
| `microsoft/azure-keyvault-certificates-rust` | release / يبقى eligible | create certificate في `:72-108`، update في `:119-123`، delete في `:129`. signing في `:154-185` يستخدم Key Vault Keys ويطبع signature. المثال يحتاج `azure_security_keyvault_keys` لكنه غير موجود في install عند `:28`؛ نقص dependency موثق، وليس blocker للترخيص/الأمن. |
| `microsoft/azure-keyvault-keys-rust` | release / يبقى eligible | get-key في `:50-59` يطبع `key.key` (عادة public key parameters/metadata وليس HSM private key)، لذا يجب التعامل معه كـintentional key-material logging. create/update/delete في `:71-112`. مثال wrap/unwrap `:136-184` يولد DEK من `random::<u32>()` فقط؛ **32-bit ليس مفتاح تشفير production مناسبًا**. هذا caveat أمني مهم محفوظ صراحة، لكنه sample توضيحي وليس توصية صريحة بقوة مفتاح production. |
| `microsoft/azure-storage-queue-rust` | release / يبقى eligible | send في `:75-90`، receive + طباعة message body في `:101-107`، delete destructive في `:115-120`، وpeek + logging في `:127-131`. النص يقول create/manage queues لكن لا يحتوي مثال queue creation/deletion؛ الملف يكفي لعمليات الرسائل لا لكل ادعاء إدارة queue resource. |
| `microsoft/m365-agents-ts` | release / يبقى eligible | `:17-18` يطلب microsoft-docs MCP وnpm version lookup، و`:24-25` unpinned npm installs. environment block يحتوي placeholders لـAPI key/client secret/bearer token. token provider في `:145-158` يقرأ bearer token ويرسله للمصادقة ولا يطبعه. Azure OpenAI sample `:73-113` يحتاج `@ai-sdk/azure` و`ai` لكن install لا يضيفهما. `:158-160` يطبع Copilot reply، والذي قد يحتوي محتوى حساسًا. |

## لماذا لم تتغير release states

لم نثبت blocker ترخيص أو dependency أو security يفرض hold. لكننا **لم نخفف** المخاطر التالية: unpinned installs، authenticated cloud calls، resource/message deletion، logging لبيانات event/queue/reply، key-material logging، ضعف DEK التوضيحي في Keys، ونقص dependencies في Certificate signing وM365 streaming.

هذه العيوب تبقى أدلة جودة/أمن مهمة. عدم تحويلها إلى hold لا يعني أنها best practice أو أنها اجتازت اختبارًا تشغيليًا.

## ما لم نختبره

لم نسجل الدخول إلى Azure/M365، لم نستخدم token حقيقيًا، لم نرسل أو نحذف events/messages/resources، لم نشغّل signing/wrap/unwrap، ولم نترجم أو نشغّل samples. لم نقس task performance ولم نجرِ human security certification.

## أثر الدفعة

تم ربط هذه الخمس فقط بـbatch 06 وإعادة حساب summary من بيانات المصفوفة؛ لم تتغير أي release state أو skill bytes أو catalog/manifest/lockfile.
