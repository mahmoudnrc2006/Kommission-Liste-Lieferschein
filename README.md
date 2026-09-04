# Etikett-Manager – Online-Version

سيرفر بسيط (Node.js) يعرض تطبيق Etikett-Manager عبر الإنترنت، محمي بكلمة
مرور، ويخزّن البيانات تلقائيًا عند Upstash Redis بحيث أي جهاز يفتح نفس
الرابط يرى نفس البيانات فورًا.

## متغيرات البيئة المطلوبة عند النشر (Render → Environment)

| المتغير | القيمة |
|---|---|
| `APP_PASSWORD` | كلمة المرور التي ستُدخلها لفتح البرنامج |
| `SESSION_SECRET` | أي نص عشوائي طويل وثابت (لا تغيّره لاحقًا وإلا يُسجَّل الخروج تلقائيًا من الجميع) |
| `UPSTASH_REDIS_REST_URL` | من لوحة تحكم قاعدة بيانات Upstash المجانية |
| `UPSTASH_REDIS_REST_TOKEN` | من نفس لوحة التحكم |
| `NODE_ENV` | `production` |

## التشغيل محليًا للتجربة

```
npm install
APP_PASSWORD=1234 SESSION_SECRET=test UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... npm start
```

ثم افتح http://localhost:3000
