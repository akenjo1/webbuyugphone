const { db } = require('./lib/firebaseAdmin');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({error: 'Method Not Allowed'});

    const { code, reward, max_users, password } = req.body;
    const ADMIN_PASS = process.env.ADMIN_PASSWORD || "admin123";

    if (password !== ADMIN_PASS) return res.status(403).json({ error: "Sai mật khẩu Admin" });

    try {
        await db.collection('gift_codes').doc(code.toUpperCase()).set({
            reward: parseInt(reward),
            max_uses: parseInt(max_users),
            used_count: 0,
            redeemed_by: [],
            createdAt: Date.now()
        });
        return res.status(200).json({ success: true, message: "Tạo code thành công!" });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
