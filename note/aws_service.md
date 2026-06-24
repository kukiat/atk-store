# AWS Services

## 1. IAM

ใช้สำหรับ credentials ฝั่ง server เพื่อ call AWS services (Rekognition, Cognito)
- ใช้วิธี `AWS_PROFILE=atk-store-dev` แทนการฝัง Access Key โดยตรง
- Node.js อ่าน credentials จาก `~/.aws/credentials` หรือ `~/.aws/config` บน machine ที่ login ไว้
- ใช้ฝั่ง BE เท่านั้น ไม่ expose ออก FE

## 2. S3

ใช้เก็บไฟล์ภาพจาก Face Liveness session
- **Reference Image** — ภาพใบหน้าอ้างอิงที่ Rekognition ถ่ายไว้ระหว่าง session
- **Audit Images** — ภาพตรวจสอบเพิ่มเติม (ถ้า `AWS_LIVENESS_AUDIT_IMAGES_LIMIT > 0`)
- Bucket: `atk-store-412664885805-ap-northeast-1-an`, prefix: `face-liveness/`

## 3. Cognito Identity Pool

ใช้เป็น credential bridge ฝั่ง BE เพื่อแลก Google ID Token → temporary AWS credentials ให้ FE
- FE จะเอา credentials ไปใช้ call Rekognition `StartFaceLivenessSession` โดยตรง
- Identity Pool configure ให้ trust Google (`accounts.google.com`) เป็น federated identity provider
- credentials มีอายุสั้น (short-lived) และ scope ไว้เฉพาะ `StartFaceLivenessSession` เท่านั้น

## 4. Amazon Rekognition — Face Liveness

ใช้ตรวจสอบว่าใบหน้าในกล้องเป็นคนจริง ไม่ได้ผ่านการ spoof (รูปถ่าย/วิดีโอ)

Commands ที่ใช้:
- `CreateFaceLivenessSessionCommand` — BE สร้าง session แล้วส่ง `sessionId` กลับ FE
- `GetFaceLivenessSessionResultsCommand` — BE ดึงผล confidence score หลัง FE scan เสร็จ

Score threshold: `AWS_LIVENESS_SCORE_THRESHOLD=70` (ต่ำกว่านี้ถือว่า rejected)

> **หมายเหตุ:** ฟีเจอร์ face matching (เปรียบเทียบใบหน้ากับ reference image) ยังไม่ได้ implement —
> `referenceS3Key` ถูกเก็บไว้ใน DB เพื่อรองรับการใช้งานในอนาคต

---

## Flow สรุป

```
User กด "เริ่ม"
  → BE: สร้าง Rekognition session (IAM via AWS_PROFILE)  ← ได้ sessionId
  → FE: ขอ credentials (/api/face/credentials)
    → BE: Cognito แลก Google ID Token → temp AWS credentials
  → FE: ใช้ sessionId + credentials เปิดกล้อง (Amplify SDK call Rekognition โดยตรง)
  → scan เสร็จ → FE แจ้ง BE (/api/face/result)
  → BE: Rekognition GetResult → confidence score → accepted / rejected
  → ถ้า accepted → เก็บ referenceS3Key (จาก S3) ใน DB และ mark user เป็น registered
```
