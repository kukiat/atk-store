# IOT Server Integration Plans

## Pronoun
- app = atk-store (this)
- iot = iot-server (server + iot device)

## app modify plan
1. Remove Shelf Configuration from app (remove all used and remove table)

2. Provide get inventories api
    - Reason
        - iot system must be using product to set as in_store (map with device)
    - Method
        - GET
    - Endpoint
        - /inventories
    - Query Parameters
        - limit: int
        - offset: int
        - search: optional string
    - Response
    ```jsonc
    [
        {
            "id":"123", //product uuid
            "name":"xxx",
            "description":"xxx",
            "price":123,
            "amount":123, //in_stock
            "image_url":"123.png"
        }
    ]
    ```

3. Remove `shelf_id` from inventories table and streamline all position is used this field
    - Reson
        - mapping by iot so the app don't need to map anymore

4. modify qr code generator use inventory id to generate instead shelf
    - ปรับ flow ตอน scan qr
        - เนื่องจากเป็น id ของสินค้าอยู่แล้ว แปลว่า ตอน scan แล้วเจอที่เป็น
            - 1 inventoryId (standalone)
                - แสดงหน้าสินค้าเลย => generate uuid เพื่อใช้ตาม flow ในข้อ 5 => แล้วก็รอรับจำนวนสะสมต ตาม flow ในข้อ 5
            - many inventoryId (grouped)
                - แสดง card เป็นสินค้า 2 ขนิด
                    - อยากได้สินค้าไหนก็เลือก => generate uuid ต่อสินค้าที่เลือก เพื่อใช้ตาม flow ในข้อ 5 => รอรับจำนวนสะสมตาม flow ในข้อ 5

5. Shelf Flow
    1. user scan qr code from shelf door
    2. call iot api to product configuration
        - method
            - GET
        - Endpoint
            - /product/:productId
        - Response
        ```jsonc
        {
            "productId":"xxx",
            "inStoreQty":123
        }
        ```
    2. app generate uuid
    3. call iot api to send uuid
        - method
            - POST
        - Endpoint
            - /set-topic
        - payload
        ```jsonc
        {
            "uuid":"xxxx"
        }
        ```
    4. app start to subscripe 2 MQTT topic according format
        - `${uuid from 2.}`/loadcell/`${read from .env at BRANCH_CODE}`/`${productId}`/event
        - example data from iot publisher (use some neccessary field)
        ```jsonc
        {
            "deviceId": "10002",
            "branch": "main",
            "event": "item_picked", // event name describe client behavior for this event describe to user picked the product
            "seq": 1044,
            "sku": "ITEM-001", // this is product uuid use this field to get product info then calculate
            "itemName": "Bolt M6",
            "grossWeightKg": 5.05,
            "netWeightKg": 4.75,
            "unitWeightKg": 0.05,
            "previousQty": 100,
            "currentQty": 95, // use this field to display shelf product balance
            "deltaQty": -5,
            "pickedQty": 5, // this is picked count use this
            "rssi": -45,
            "timestamp": "2026-06-24T10:30:00.125Z"
        }
        ```
        - `${uuid from 2.}`/loadcell/`${read from .env at BRANCH_CODE}`/`${productId}`/status
        - example data from iot publisher (use some neccessary field)
        ```jsonc
        {
            "deviceId": "10002",
            "branch": "main",
            "seq": 1042,
            "online": true,
            "reason": "heartbeat",
            "uptime": 3600,
            "freeHeap": 182340,
            "rssi": -45,
            "status": "shelf_closed" //use this field and check if value is shelf_closed then unsubscribe this topic
        }
        ```
    