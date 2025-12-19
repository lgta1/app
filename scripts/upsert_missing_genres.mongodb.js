// Run with:
//   mongosh 'mongodb://USER:PASS@host:27017/test?authSource=admin' --file scripts/upsert_missing_genres.mongodb.js
// hoặc đặt env MONGO_URL rồi gọi mongosh --file ...

let col;
try {
  if (typeof db !== 'undefined') {
    // Đang chạy trong phiên mongosh đã kết nối qua CLI URI
    print('Using current mongosh connection. db =', db.getName());
    col = db.getCollection('genres');
  } else {
    const uri = process.env.MONGO_URL || 'mongodb://localhost:27017/test';
    const dbName = uri.split('/').pop().split('?')[0];
    print('Connecting via script. db =', dbName);
    const conn = new Mongo(uri);
    const _db = conn.getDB(dbName);
    col = _db.getCollection('genres');
    // cũng gán db để dùng bên dưới nếu cần
    this.db = _db;
  }
} catch (e) {
  print('Connection error:', e.message);
  throw e;
}

// Load array (kept inline to avoid filesystem dependency when copying script):
const missing = [
  {slug:'bbm',name:'BBM',description:'Nhân vật nam có thân hình to lớn, cơ bắp, thường xuất hiện trong các cảnh mạnh mẽ, quyền lực.'},
  {slug:'bbw',name:'BBW',description:'Nhân vật nữ có thân hình đầy đặn, quyến rũ, tập trung vào vẻ đẹp tự nhiên và sự gợi cảm.'},
  {slug:'bisexual',name:'Bisexual',description:'Nhân vật có xu hướng tình dục với cả nam và nữ, thể hiện sự đa dạng trong các mối quan hệ.'},
  {slug:'blindfold',name:'Blindfold',description:'Quan hệ khi nhân vật bị bịt mắt, tăng cảm giác bí ẩn và kích thích.'},
  {slug:'bloomers',name:'Bloomers',description:'Nhân vật mặc quần bó thể thao kiểu Nhật, thường xuất hiện trong bối cảnh học đường hoặc luyện tập.'},
  {slug:'body-writing',name:'Body Writing',description:'Viết chữ hoặc vẽ lên cơ thể nhân vật, tạo cảm giác sở hữu và kích thích thị giác.'},
  {slug:'breast-sucking',name:'Breast Sucking',description:'Hành động bú hoặc mút ngực, nhấn mạnh sự thân mật và khoái cảm.'},
  {slug:'bukkake',name:'Bukkake',description:'Nhiều nhân vật xuất tinh lên một người, tạo cảnh tượng táo bạo và quá tải khoái cảm.'},
  {slug:'bunny-girl',name:'Bunny Girl',description:'Nhân vật nữ mặc trang phục thỏ gợi cảm với tai và tất lưới, tạo sức hút quyến rũ.'},
  {slug:'chastity-belt',name:'Chastity belt',description:'Nhân vật đeo đai trinh tiết, nhấn mạnh sự kiểm soát và cấm đoán trong ham muốn.'},
  {slug:'cheerleader',name:'Cheerleader',description:'Nhân vật mặc đồng phục cổ động năng động, gợi cảm trong bối cảnh thể thao hoặc học đường.'},
  {slug:'collar',name:'Collar',description:'Vòng cổ biểu thị sự phục tùng, thuộc quyền sở hữu hoặc gắn kết quan hệ chủ - tớ.'},
  {slug:'cum-swap',name:'Cum swap',description:'Trao đổi tinh dịch qua miệng giữa các nhân vật, tạo cảm giác thân mật táo bạo.'},
  {slug:'drunk',name:'Drunk',description:'Nhân vật say rượu, hành động tình dục diễn ra trong trạng thái mất kiểm soát hoặc mơ hồ.'},
  {slug:'elder-sister',name:'Elder Sister',description:'Chị gái trong các mối quan hệ gia đình hoặc cấm kỵ, thường vừa che chở vừa cám dỗ.'},
  {slug:'facesitting',name:'Facesitting',description:'Nhân vật ngồi lên mặt đối phương để được phục vụ khoái cảm trực tiếp.'},
  {slug:'females-only',name:'Females only',description:'Chỉ có các nhân vật nữ xuất hiện, tạo không gian đồng giới hoặc nữ quyền.'},
  {slug:'feminization',name:'Feminization',description:'Nam bị biến đổi hoặc hóa trang thành nữ, nhấn mạnh sự thay đổi giới tính và tâm lý.'},
  {slug:'gag',name:'Gag',description:'Nhân vật bị bịt miệng bằng đồ vật, tăng cảm giác bị khống chế và phục tùng.'},
  {slug:'garter-belts',name:'Garter Belts',description:'Đai giữ tất tôn vẻ đẹp đôi chân và đường cong cơ thể, tăng độ gợi cảm.'},
  {slug:'glory-hole',name:'Glory hole',description:'Quan hệ qua lỗ kín trên vách ngăn, tăng yếu tố ẩn danh, bí ẩn và táo bạo.'},
  {slug:'hairjob',name:'Hairjob',description:'Kích thích bằng tóc, tạo trải nghiệm thị giác và xúc giác mới lạ.'},
  {slug:'hell-no',name:'Hell No',description:'Nội dung bị từ chối hoặc phản đối mạnh, đôi khi dùng làm yếu tố hài hước.'},
  {slug:'hidden-sex',name:'Hidden sex',description:'Quan hệ diễn ra bí mật, tránh bị người khác phát hiện, tăng cảm giác hồi hộp.'},
  {slug:'imouto',name:'Imouto',description:'Em gái dễ thương, gắn bó với nhân vật chính, đôi khi phát triển cảm xúc cấm kỵ.'},
  {slug:'insect',name:'Insect',description:'Nhân vật hoặc sinh vật côn trùng tham gia cảnh tình dục kỳ lạ (khác với \'Côn trùng\' bản địa).'},
  {slug:'kissing',name:'Kissing',description:'Hôn môi, thể hiện sự thân mật, khởi đầu cho cảm xúc và khoái cảm.'},
  {slug:'lolicon',name:'Lolicon',description:'Nhân vật nữ ngoại hình nhỏ, trẻ trung tạo cảm giác cấm kỵ; khác nhấn mạnh so với chung \'Loli\'.'},
  {slug:'males-only',name:'Males only',description:'Chỉ có các nhân vật nam xuất hiện, tạo bối cảnh đồng giới nam.'},
  {slug:'mature',name:'Mature',description:'Nhân vật trưởng thành, giàu kinh nghiệm, toát lên nét quyến rũ chín muồi.'},
  {slug:'mermaid',name:'Mermaid',description:'Nhân vật nữ người cá, kết hợp yếu tố giả tưởng dưới nước đầy mê hoặc.'},
  {slug:'monstergirl',name:'Monstergirl',description:'Nhân vật nữ mang đặc điểm quái vật (sừng, đuôi…), vừa dị thường vừa quyến rũ.'},
  {slug:'non-hen',name:'Non-hen',description:'Nội dung không tập trung vào cảnh tình dục, thiên về cốt truyện hoặc hài hước.'},
  {slug:'old-man',name:'Old Man',description:'Nhân vật nam lớn tuổi xuất hiện trong các tình huống cấm kỵ hoặc gây tò mò.'},
  {slug:'oral',name:'Oral',description:'Quan hệ bằng miệng, tập trung mô tả kỹ thuật và khoái cảm trực tiếp.'},
  {slug:'osananajimi',name:'Osananajimi',description:'Bạn thuở nhỏ gắn bó từ lâu, mối quan hệ chuyển dần sang lãng mạn hoặc tình dục.'},
  {slug:'pegging',name:'Pegging',description:'Nữ dùng đồ chơi đeo để quan hệ qua hậu môn với nam, đảo ngược vai trò truyền thống.'},
  {slug:'piercing',name:'Piercing',description:'Khuyên trên cơ thể (môi, lưỡi, ngực…) tạo hình tượng nổi loạn và gợi cảm.'},
  {slug:'ponytail',name:'Ponytail',description:'Nhân vật buộc tóc đuôi ngựa, thể hiện sự năng động, khỏe khoắn và quyến rũ.'},
  {slug:'rimjob',name:'Rimjob',description:'Kích thích hậu môn bằng miệng, trải nghiệm táo bạo và cảm giác lạ.'},
  {slug:'ryona',name:'Ryona',description:'Nhân vật chịu đau đớn thể xác kết hợp yếu tố tình dục gây sốc và căng thẳng.'},
  {slug:'scat',name:'Scat',description:'Nội dung liên quan đến phân – yếu tố cực đoan, gây tranh cãi và kén người xem.'},
  {slug:'shimapan',name:'Shimapan',description:'Quần lót sọc dễ thương, thường dùng trong bối cảnh học đường hài hước hoặc gợi cảm.'},
  {slug:'shoujo',name:'Shoujo',description:'Phong cách hướng tới nữ trẻ: cảm xúc lãng mạn, nhẹ nhàng, giàu biểu cảm.'},
  {slug:'sixty-nine',name:'Sixty-Nine',description:'Tư thế hai người đồng thời kích thích nhau bằng miệng, nhấn mạnh sự tương hỗ.'},
  {slug:'spanking',name:'Spanking',description:'Đánh mông tạo cảm giác đau nhẹ xen khoái cảm và phục tùng.'},
  {slug:'strap-on',name:'Strap-on',description:'Dùng đồ chơi đeo (dương vật giả) để chủ động quan hệ với đối phương.'},
  {slug:'tail-plug',name:'Tail plug',description:'Đồ chơi hình đuôi thú gắn vào cơ thể, tạo nét hoang dã và gợi cảm.'},
  {slug:'tracksuit',name:'Tracksuit',description:'Nhân vật mặc đồ thể thao bó sát, nhấn mạnh sự khỏe khoắn và đường cong.'},
  {slug:'twintails',name:'Twintails',description:'Tóc buộc hai bên trẻ trung, thường gắn với tính cách năng động hoặc tsundere nhẹ.'},
  {slug:'vampire',name:'Vampire',description:'Ma cà rồng quyến rũ, kết hợp yếu tố hút máu và mê hoặc dục tính.'},
  {slug:'vtuber',name:'Vtuber',description:'Nhân vật ảo do streamer điều khiển, xuất hiện trong nội dung gợi cảm hoặc tương tác độc đáo.'},
  {slug:'wormhole',name:'Wormhole',description:'Quan hệ qua cổng không gian hoặc lối xuyên chiều, tăng tính kỳ ảo mới lạ.'},
  {slug:'zombie',name:'Zombie',description:'Xác sống xuất hiện trong bối cảnh kinh dị, xen yếu tố tình dục kỳ quái hoặc đen tối.'}
];

let inserted = 0, updated = 0, skipped = 0;
missing.forEach(g => {
  const existing = col.findOne({slug: g.slug});
  if(existing){
    col.updateOne({slug: g.slug}, {$set: {name: g.name, description: g.description}});
    updated++;
  } else {
    col.updateOne({slug: g.slug}, {$set: {name: g.name, description: g.description, category: 'general'}}, {upsert:true});
    inserted++;
  }
});

// Ensure unique index on slug
try { col.createIndex({slug:1}, {unique:true}); } catch(e){ print('Index error:', e.message); }

print('Upsert complete. Inserted:', inserted, 'Updated:', updated, 'Skipped:', skipped);
print('Total in collection now:', col.countDocuments());
