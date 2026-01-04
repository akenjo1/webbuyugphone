const { db } = require('./lib/firebaseAdmin');
const fetch = require('node-fetch');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({error: 'Method Not Allowed'});

    const { uid, host_url } = req.body;
    // Lấy IP thật của người dùng trên Vercel
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ip = clientIp.split(',')[0].trim(); // Lấy IP đầu tiên nếu có nhiều proxy

    const SHRINK_API = process.env.SHRINKME_API_KEY || "a16ba54df502d11a43d8e2b10f2d2fbb9b8e29f7";

    if (!uid) return res.status(401).json({ error: "Chưa đăng nhập" });

    // --- KIỂM TRA GIỚI HẠN IP (3 LẦN/NGÀY) ---
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const ipRef = db.collection('ip_limits').doc(ip.replace(/\./g, '_')); // Thay dấu chấm thành _ để làm ID

    try {
        const ipDoc = await ipRef.get();
        let ipData = ipDoc.exists ? ipDoc.data() : { count: 0, date: today };

        // Nếu sang ngày mới -> Reset count
        if (ipData.date !== today) {
            ipData = { count: 0, date: today };
        }

        if (ipData.count >= 3) {
            return res.status(400).json({ error: `IP của bạn (${ip}) đã hết lượt vượt link hôm nay (3/3).` });
        }

        // --- TẠO MÃ & LINK ---
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();

        // Lưu mã chờ xác nhận
        await db.collection('pending_codes').doc(code).set({
            uid: uid,
            ip: ip,
            createdAt: Date.now(),
            valid: true,
            expiresAt: Date.now() + 15 * 60 * 1000 // 15 phút
        });

        // Tăng count cho IP này (Lưu tạm, khi nhập code thành công mới tính là chuẩn, 
        // nhưng để tránh spam tạo link, ta có thể tăng ngay hoặc xử lý logic khác. 
        // Ở đây tôi chọn cách: Tạo link là tính 1 lượt để tránh spam request).
        await ipRef.set({ count: ipData.count + 1, date: today });

        const destinationUrl = `${host_url}/code.html?c=${code}`;
        
        // Gọi ShrinkMe
        const shrinkRes = await fetch(`https://shrinkme.io/api?api=${SHRINK_API}&url=${encodeURIComponent(destinationUrl)}`);
        const shrinkJson = await shrinkRes.json();

        if (shrinkJson.status === 'error') throw new Error("Lỗi ShrinkMe: " + shrinkJson.message);

        return res.status(200).json({ 
            success: true, 
            shortenedUrl: shrinkJson.shortenedUrl,
            remaining: 3 - (ipData.count + 1)
        });

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
