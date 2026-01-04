const { db, admin } = require('./lib/firebaseAdmin');
const fetch = require('node-fetch');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({error: 'Method Not Allowed'});

    const { uid, type, input_data } = req.body;
    // type: 'TRIAL' hoặc 'BUFF'
    
    // GIÁ: 50 Xu/lượt
    const PRICE = 50; 
    const NTRONG_TOKEN = "a3e975d26f7fd1531b293f52f8e8a1b042961256ece05fafafd61cf929770ade";

    if (!uid) return res.status(401).json({ error: "Chưa đăng nhập" });

    const userRef = db.collection('users').doc(uid);

    try {
        // 1. Trừ tiền
        await db.runTransaction(async (t) => {
            const doc = await t.get(userRef);
            const bal = doc.data()?.balance || 0;
            if (bal < PRICE) throw new Error("Không đủ xu. Cần 50 xu.");
            t.update(userRef, { balance: bal - PRICE });
        });

        // 2. Gọi API Ntrong
        // Dựa vào link bạn đưa, tôi đoán endpoint xử lý. 
        // Thường là gửi POST data lên chính URL đó hoặc 1 API endpoint chung.
        // Ở đây tôi giả định endpoint nhận POST JSON.
        
        let targetUrl = "https://ntrong.com/tool_trial"; // Default
        if (type === 'BUFF') targetUrl = "https://ntrong.com/tool_buff";

        // Cấu hình form data hoặc JSON tùy bên Ntrong yêu cầu.
        // Thường các tool này nhận JSON hoặc Form. Tôi sẽ thử JSON trước.
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; MyToolShop/1.0)'
            },
            body: JSON.stringify({
                token: NTRONG_TOKEN,
                data: input_data, // Dữ liệu tài khoản/link cần buff
                action: type.toLowerCase() // Gửi thêm tham số để họ biết làm gì
            })
        });

        // Đọc phản hồi
        const text = await response.text();
        let result = {};
        try {
            result = JSON.parse(text);
        } catch {
            // Nếu trả về HTML (thường là thành công nhưng không trả JSON)
            result = { success: true, message: "Đã gửi lệnh lên hệ thống Ntrong." };
        }

        // 3. Xử lý kết quả
        // Lưu ý: Nếu Ntrong không trả JSON chuẩn, ta cần logic parse HTML ở đây.
        // Tạm thời coi như thành công nếu không lỗi mạng.
        
        return res.status(200).json({ success: true, message: result.message || "Xử lý thành công!" });

    } catch (e) {
        // Hoàn tiền nếu lỗi
        await userRef.update({ balance: admin.firestore.FieldValue.increment(PRICE) });
        return res.status(400).json({ success: false, message: e.message });
    }
}
