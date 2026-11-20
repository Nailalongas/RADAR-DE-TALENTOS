// Only explicit source-provided categories are accepted. No inference from artist names or event titles.
export function attachTalentCategories(db,talentId,categories=[]){
 if(!Array.isArray(categories)||categories.length>100)throw Error('Categorias inválidas');
 const byId=db.prepare('SELECT id FROM categories WHERE id=?'),byName=db.prepare('SELECT id FROM categories WHERE name=? COLLATE NOCASE');
 const add=db.prepare('INSERT OR IGNORE INTO talent_categories(talent_id,category_id) VALUES(?,?)');
 for(const c of categories){const row=Number.isSafeInteger(c)?byId.get(c):typeof c==='string'&&c.trim()?byName.get(c.trim()):null;if(!row)throw Error('Categoria desconhecida: '+String(c));add.run(talentId,row.id);}
}
