const { db, admin } = require('./lib/firebaseAdmin');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({error: 'Method Not Allowed'});
    
    const { uid, code } = req.body;
    if (!uid || !code) return res.status(400).json({ error: "Thiếu thông tin" });

    const codeInput = code.trim().toUpperCase();
    const userRef = db.collection('users').doc(uid);
    const linkCodeRef = db.collection('pending_codes').doc(codeInput);
    const promoRef = db.collection('gift_codes').doc(codeInput);

    try {
        const msg = await db.runTransaction(async (t) => {
            const linkSnap = await t.get(linkCodeRef);
            const promoSnap = await t.get(promoRef);

            // 1. Check Mã Vượt Link
            if (linkSnap.exists) {
                const data = linkSnap.data();
                if (data.uid !== uid) throw new Error("Mã này không phải của bạn.");
                if (!data.valid) throw new Error("Mã đã sử dụng.");
                
                t.update(linkCodeRef, { valid: false, usedAt: Date.now() });
                t.set(userRef, { balance: admin.firestore.FieldValue.increment(100) }, { merge: true });
                return "Nhận 100 Xu thành công!";
            }

            // 2. Check Giftcode Admin
            if (promoSnap.exists) {
                const data = promoSnap.data();
                if (data.used_count >= data.max_uses) throw new Error("Mã đã hết lượt.");
                if (data.redeemed_by && data.redeemed_by.includes(uid)) throw new Error("Bạn đã nhập mã này rồi.");

                t.update(promoRef, {
                    used_count: admin.firestore.FieldValue.increment(1),
                    redeemed_by: admin.firestore.FieldValue.arrayUnion(uid)
                });
                t.set(userRef, { balance: admin.firestore.FieldValue.increment(data.reward) }, { merge: true });
                return `Nhận ${data.reward} Xu thành công!`;
            }

            throw new Error("Mã không hợp lệ.");
        });

        return res.status(200).json({ success: true, message: msg });
    } catch (e) {
        return res.status(400).json({ error: e.message });
    }
}
