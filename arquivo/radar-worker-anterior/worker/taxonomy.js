const talentTaxonomy = {
  Palestrantes: ['Empreendedorismo','Vendas','Liderança','Inteligência artificial','Finanças','Saúde mental','Desenvolvimento pessoal','Educação','Diversidade','Comunicação','Relacionamentos'],
  Cantores: ['Sertanejo','Samba e pagode','MPB','Rock','Pop','Gospel','Forró','Música infantil','Funk','Rap e hip-hop','Música eletrônica'],
  Humoristas: ['Stand-up','Imitações','Humor musical','Improviso','Humor digital'],
  Artistas: ['Atores','Apresentadores','Mágicos','Dançarinos','Artistas circenses','Literatura e escrita'],
  Influenciadores: ['Gastronomia','Beleza e moda','Viagens','Games','Tecnologia','Fitness','Família','Saúde e bem-estar','Finanças','Educação','Fé e espiritualidade'],
  'Infantil e família': ['Shows infantis','Personagens e espetáculos licenciados','Teatro de bonecos','Contação de histórias','Circo para a família'],
  'Peças de teatro e musicais': ['Peças de teatro','Musicais','Monólogos','Companhias de teatro'],
  'Gastronomia': ['Chefs e cozinheiros','Festivais gastronômicos','Oficinas culinárias','Degustações','Jantares temáticos']
};
function validTalentTopics(topics, categories) {
  return Array.isArray(topics) && topics.length <= 60 && topics.every(t => {
    if(typeof t !== 'string') return false;
    const [category, theme, extra] = t.split('|');
    return !extra && categories.includes(category) && talentTaxonomy[category]?.includes(theme);
  });
}
function talentTopicKeys(rows) {
  return [...new Set(rows.flatMap(r => Array.isArray(r.subcategorias) ? r.subcategorias : []))];
}
// Only explicit biography evidence; never infer a theme from a person's name.
function suggestedBiographyTopics(profile) {
  const text=String(profile.description||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const categories=profile.categorias||[profile.categoria];
  const aliases={'Stand-up':/\bstand[ -]?up\b/,'Imitações':/\bimitador|\bimitacoes\b/,'Humor musical':/\bhumor musical\b/,'Improviso':/\bimproviso|\bimprovisacao\b/,'Humor digital':/\bhumor digital\b/};
  return categories.flatMap(c=>(talentTaxonomy[c]||[]).filter(t=>{
    const normalized=t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return aliases[t]?aliases[t].test(text):text.includes(normalized);
  }).map(t=>c+'|'+t));
}
const eventCategoryTerms={
  'Infantil e família':/\b(teatro infantil|musicais? infanti[ls]|espetaculos? infanti[ls]|shows? infanti[ls]|teatro de bonecos|circo para a familia)\b/,
  'Peças de teatro e musicais':/\b(teatro musical|companhia (?:de teatro|teatral)|pecas? (?:de teatro|teatrais?)|espetaculos? teatrais?)\b/,
  Gastronomia:/\b(gastronomia|chef de cozinha|festival gastronomico|oficinas? culinarias?)\b/
};

