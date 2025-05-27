// index email
db.users.createIndex({ email: 1 }, { unique: true });

// index name
db.users.createIndex({ createdAt: -1 });
