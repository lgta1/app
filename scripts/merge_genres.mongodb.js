// Usage:
//   # Set DB connection if needed, else defaults to mongodb://localhost:27017/test
//   // PowerShell
//   // $env:MONGO_URL="mongodb://localhost:27017/test"
//   // mongosh --file scripts/merge_genres.mongodb.js

const uri = process.env.MONGO_URL || 'mongodb://localhost:27017/test';
const dbName = uri.split('/').pop().split('?')[0];
print('Connecting to', uri, 'db =', dbName);

const conn = new Mongo(uri);
const db = conn.getDB(dbName);
const genresCol = db.getCollection('genres');
const mangaCol = db.getCollection('mangas');

// Define canonical mappings as requested
const mappings = [
  {
    canonicalSlug: 'blindfold',
    canonicalName: 'blinfold',
    aliasSlugs: ['bit-mat', 'blindfold'],
  },
  {
    canonicalSlug: 'insect',
    canonicalName: 'Insect (côn trùng)',
    aliasSlugs: ['con-trung', 'insect'],
  },
  {
    canonicalSlug: 'lolicon',
    canonicalName: 'Lolicon',
    aliasSlugs: ['loli', 'lolicon'],
  },
];

function ensureUniqueIndex() {
  try { genresCol.createIndex({ slug: 1 }, { unique: true }); } catch (e) { print('Index create error:', e.message); }
}

function mergeOne(map) {
  print('\n=== Merge ===');
  try { printjson(map); } catch (e) { print('map:', JSON.stringify(map)); }
  const { canonicalSlug, canonicalName, aliasSlugs } = map;
  const aliasSet = (aliasSlugs || []).filter(Boolean);

  let canonicalDoc = genresCol.findOne({ slug: canonicalSlug });
  const aliasDocs = aliasSet.filter(s => s !== canonicalSlug).map(s => genresCol.findOne({ slug: s })).filter(Boolean);

  if (!canonicalDoc) {
    if (aliasDocs.length > 0) {
      const base = aliasDocs[0];
      print(' - Using base alias doc', base.slug, '-> rename to', canonicalSlug);
      // Try rename alias to canonical
      const dupe = genresCol.findOne({ slug: canonicalSlug });
      if (!dupe) {
        genresCol.updateOne({ _id: base._id }, { $set: { slug: canonicalSlug, name: canonicalName } });
        canonicalDoc = genresCol.findOne({ _id: base._id });
      } else {
        print(' ! Conflict: canonical slug already exists, will not rename base');
        canonicalDoc = dupe;
        genresCol.updateOne({ _id: canonicalDoc._id }, { $set: { name: canonicalName } });
      }
    } else {
      print(' - No existing docs found; creating new canonical doc');
      genresCol.insertOne({ slug: canonicalSlug, name: canonicalName, description: '', category: 'general', createdAt: new Date(), updatedAt: new Date() });
      canonicalDoc = genresCol.findOne({ slug: canonicalSlug });
    }
  } else {
    // Ensure desired name
    genresCol.updateOne({ _id: canonicalDoc._id }, { $set: { name: canonicalName } });
  }

  // Cascade updates on manga: replace each alias slug with canonicalSlug
  const aliasesToReplace = aliasSet.filter(s => s !== canonicalSlug);
  aliasesToReplace.forEach((alias) => {
    const affected = mangaCol.countDocuments({ genres: alias });
    if (affected > 0) {
      print(` - Cascading ${alias} -> ${canonicalSlug} for ${affected} manga docs`);
      mangaCol.updateMany(
        { genres: alias },
        { $addToSet: { genres: canonicalSlug }, $pull: { genres: alias } }
      );
    }
  });

  // Remove redundant alias docs (now replaced)
  if (aliasesToReplace.length) {
    const delRes = genresCol.deleteMany({ slug: { $in: aliasesToReplace } });
    print(' - Deleted redundant alias docs:');
    try { printjson(delRes); } catch (e) { print(JSON.stringify(delRes)); }
  }

  // Final: print resulting genre doc
  const finalDoc = genresCol.findOne({ slug: canonicalSlug }, { name: 1, slug: 1 });
  print(' - Final canonical:');
  try { printjson(finalDoc); } catch (e) { print(JSON.stringify(finalDoc)); }
}

ensureUniqueIndex();

mappings.forEach(mergeOne);

print('\nDone merging. Distinct slug count =', genresCol.distinct('slug').length, ', total genres =', genresCol.countDocuments());
