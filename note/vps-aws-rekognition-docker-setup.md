# ตั้งค่า AWS Rekognition บน VPS ภายนอกด้วย Docker Compose

คู่มือนี้ใช้สำหรับ deploy ATK Store บน VPS ที่ไม่ได้อยู่บน AWS และต้องให้ Face Liveness, Face Recognition และกล้องทำงานผ่าน Amazon Rekognition

> ห้ามนำ AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, ไฟล์ environment production หรือไฟล์ CSV ที่ AWS สร้างขึ้นไป commit, ส่งผ่านแชต หรือเก็บไว้ใน Docker image

## ภาพรวม

ระบบนี้ใช้สิทธิ์ AWS สองส่วนแยกกัน:

| ส่วน | ใช้อะไร | สิทธิ์ |
| --- | --- | --- |
| Next.js backend ใน Docker บน VPS | Access key ของ IAM user | สร้าง/อ่าน Face Liveness, index/search face และเข้าถึง S3 output |
| Face Liveness detector ใน browser | Temporary credentials จาก Cognito Identity Pool | rekognition:StartFaceLivenessSession เท่านั้น |

อย่าส่ง access key ของ backend ไป browser และอย่าให้ Cognito role ของ browser มีสิทธิ์ index/search ใบหน้า หรือ S3

## สิ่งที่ต้องมีล่วงหน้า

- AWS account ที่เปิดใช้ Rekognition Face Liveness ใน ap-northeast-1
- Rekognition Face Collection ที่ตรงกับ AWS_FACE_COLLECTION_ID
- S3 bucket สำหรับ AWS_LIVENESS_OUTPUT_BUCKET ใน account และ region เดียวกับ Face Liveness
- Cognito Identity Pool ที่เชื่อม Google provider และมี authenticated role
- VPS ที่มี Docker Compose และ service ชื่อ ATK-Store

## 1. สร้าง IAM user สำหรับ backend

1. เข้า AWS Console → IAM → Users → Create user
2. ตั้งชื่อ เช่น atk-store-vps
3. ไม่ต้องเปิด AWS Management Console access
4. กด Create user

IAM user นี้มีไว้สำหรับ process Next.js บน VPS เท่านั้น ไม่ใช่ user สำหรับคนเข้า AWS Console

## 2. ใส่ least-privilege policy

เปิด user atk-store-vps → Permissions → Add permissions → Create inline policy → JSON แล้ววาง policy นี้

แทนค่าเหล่านี้ก่อนบันทึก:

- <AWS_ACCOUNT_ID>: AWS account ID 12 หลัก
- <AWS_FACE_COLLECTION_ID>: ค่าจาก environment ของระบบ
- <AWS_LIVENESS_OUTPUT_BUCKET>: ค่าจาก environment ของระบบ
- <AWS_LIVENESS_OUTPUT_PREFIX>: prefix เช่น face-liveness/

    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Sid": "FaceLivenessBackend",
          "Effect": "Allow",
          "Action": [
            "rekognition:CreateFaceLivenessSession",
            "rekognition:GetFaceLivenessSessionResults"
          ],
          "Resource": "*"
        },
        {
          "Sid": "FaceCollectionOnly",
          "Effect": "Allow",
          "Action": [
            "rekognition:IndexFaces",
            "rekognition:SearchFacesByImage"
          ],
          "Resource": "arn:aws:rekognition:ap-northeast-1:<AWS_ACCOUNT_ID>:collection/<AWS_FACE_COLLECTION_ID>"
        },
        {
          "Sid": "LivenessOutputImagesOnly",
          "Effect": "Allow",
          "Action": [
            "s3:PutObject",
            "s3:GetObject"
          ],
          "Resource": "arn:aws:s3:::<AWS_LIVENESS_OUTPUT_BUCKET>/<AWS_LIVENESS_OUTPUT_PREFIX>*"
        }
      ]
    }

ตัวอย่าง S3 resource เมื่อ prefix คือ face-liveness/:

    arn:aws:s3:::my-liveness-bucket/face-liveness/*

หากไม่มี prefix ให้ใช้:

    arn:aws:s3:::my-liveness-bucket/*

ตั้งชื่อ policy เช่น atk-store-vps-face แล้วกด Create policy

ไม่ต้องเพิ่ม RekognitionFullAccess, AmazonS3FullAccess, s3:DeleteObject, s3:ListBucket, rekognition:DeleteFaces หรือสิทธิ์สร้าง/ลบ collection

### กรณีใช้ customer-managed KMS key

โค้ดปัจจุบันไม่ได้ส่ง KmsKeyId ให้ Rekognition หากภายหลังตั้ง Face Liveness ให้ใช้ customer-managed KMS key ให้เพิ่ม statement นี้ โดยแทน <KMS_KEY_ARN>

    {
      "Sid": "FaceLivenessKmsKey",
      "Effect": "Allow",
      "Action": [
        "kms:DescribeKey",
        "kms:GenerateDataKey",
        "kms:Decrypt"
      ],
      "Resource": "<KMS_KEY_ARN>"
    }

## 3. สร้าง access key

1. เปิด IAM user atk-store-vps
2. ไปแท็บ Security credentials
3. หัวข้อ Access keys → Create access key
4. หน้า use case เลือก Other → Next
5. ตั้ง description เช่น atk-store-vps-docker → Create access key
6. Download CSV file และเก็บในที่ปลอดภัย

AWS จะแสดง secret access key เพียงครั้งเดียว หากหายต้องสร้าง key ใหม่และปิด key เดิม

## 4. เก็บ secret บน VPS

SSH เข้า VPS แล้วรัน:

    mkdir -p ~/atk-store-secrets
    chmod 700 ~/atk-store-secrets
    nano ~/atk-store-secrets/aws.env

ใส่เฉพาะสองค่า โดยไม่มี # นำหน้า:

    AWS_ACCESS_KEY_ID=replace-with-access-key-id
    AWS_SECRET_ACCESS_KEY=replace-with-secret-access-key

บันทึกไฟล์แล้วล็อก permission:

    chmod 600 ~/atk-store-secrets/aws.env
    echo "$HOME/atk-store-secrets/aws.env"

คำสั่งสุดท้ายแสดง absolute path ที่ต้องใช้ใน Compose เช่น /root/atk-store-secrets/aws.env

ไม่ต้องติดตั้ง AWS CLI และไม่ต้องตั้ง profile ใน /root/.aws เพราะ AWS SDK ใน container อ่านสอง environment variables นี้ได้โดยตรง

## 5. ผูก secret file กับ Docker Compose

ใน Compose file ที่ deploy VPS ให้เพิ่ม secret file เข้า env_file ของ service ATK-Store

จากเดิม:

    services:
      ATK-Store:
        env_file:
          - ./atk-store/.env

แก้เป็น:

    services:
      ATK-Store:
        env_file:
          - ./atk-store/.env
          - /root/atk-store-secrets/aws.env

แทน path ตัวอย่างด้วย absolute path จากขั้นที่ 4

ใน ./atk-store/.env:

- ปล่อย AWS_ACCESS_KEY_ID และ AWS_SECRET_ACCESS_KEY ที่เป็น comment ไว้ได้ ไม่ต้องใส่ key ซ้ำ
- ลบ AWS_PROFILE=... ออกสำหรับ production VPS

ห้ามเพิ่ม secret ใน Dockerfile หรือส่งด้วย Docker build argument เพราะอาจฝัง credential ใน image layer

## 6. Validate และ restart เฉพาะแอป

ตรวจ YAML โดยไม่แสดงค่า environment:

    docker compose config -q

ถ้าไม่มี output หรือ error ให้ recreate เฉพาะแอป โดยไม่ restart database, Redis และ service อื่น:

    docker compose up -d --no-deps --force-recreate ATK-Store
    docker compose ps ATK-Store

รอให้ Next.js boot แล้วตรวจ log:

    sleep 15
    docker compose logs --tail=80 ATK-Store

สถานะที่ถูกต้องควรเห็น Up และ log Ready

## 7. ทดสอบจากกล้อง

เปิด log ติดตาม:

    docker compose logs -f --tail=20 ATK-Store

จากนั้นให้กล้องยิงภาพเข้าแอปหนึ่งครั้งตาม flow ปกติ แล้วดูผลลัพธ์

- ไม่มี CredentialsProviderError: backend อ่าน AWS key ได้แล้ว
- AccessDeniedException: key ใช้ได้ แต่ action, collection ARN, bucket หรือ prefix ใน policy ไม่ถูกต้อง
- InvalidS3ObjectException: ตรวจ bucket, prefix, region และ s3:GetObject

## 8. Cognito role สำหรับ browser Face Liveness

Cognito Identity Pool ต้องมี authenticated IAM role สำหรับ temporary credential ที่ browser ได้รับ ให้ role นี้มีเฉพาะ policy:

    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Sid": "BrowserFaceLivenessStreamOnly",
          "Effect": "Allow",
          "Action": "rekognition:StartFaceLivenessSession",
          "Resource": "*"
        }
      ]
    }

ไม่ต้องใส่ cognito-identity:GetId หรือ cognito-identity:GetCredentialsForIdentity ใน policy ของ IAM user บน VPS: Cognito ตรวจสอบ Google token และออก temporary credential ผ่าน identity pool เอง

## การแก้ปัญหาที่พบบ่อย

| อาการ | สิ่งที่ตรวจ |
| --- | --- |
| CredentialsProviderError: Could not load credentials from any providers | aws.env อยู่ path จริง, มีสอง key แบบไม่ comment, เพิ่มใต้ ATK-Store.env_file และ recreate container แล้ว |
| AccessDeniedException จาก Rekognition | ตรวจ action, region ap-northeast-1, account ID และ collection ARN |
| Face Liveness สร้าง session ไม่ได้ | ตรวจ s3:PutObject, bucket region และ bucket อยู่ account เดียวกัน |
| Search/index จาก reference image ไม่ได้ | ตรวจ s3:GetObject ที่ output bucket/prefix |
| Detector browser ล้ม แต่ backend สร้าง session ได้ | ตรวจ Cognito Identity Pool, Google provider, authenticated role และ StartFaceLivenessSession |
| AWS SDK เตือน Node ต่ำกว่า 22 | Dockerfile ปัจจุบันใช้ Node 20; เปลี่ยน base และ runner image เป็น Node 22+ แล้ว build/push/deploy ใหม่ |

## Security maintenance

- ใช้ IAM user นี้กับ VPS นี้เท่านั้น
- หมุน key อย่างปลอดภัย: สร้าง key ใหม่, อัปเดต aws.env, recreate container, ทดสอบ แล้วปิด key เก่า
- เปิด CloudTrail และทบทวน access key ที่ไม่ได้ใช้
- จำกัดสิทธิ์ SSH และเก็บ backup ของ aws.env ในระบบที่เข้ารหัส

## เอกสารอ้างอิง

- [AWS Rekognition IAM actions and resources](https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazonrekognition.html)
- [AWS Face Liveness API flow](https://docs.aws.amazon.com/rekognition/latest/dg/face-liveness-programming-api.html)
- [AWS IAM user access keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)

