export const talentTaxonomy = {
  Palestrantes: [
    'Empreendedorismo',
    'Vendas',
    'Liderança',
    'Inteligência artificial',
    'Finanças',
    'Saúde mental',
    'Desenvolvimento pessoal',
    'Educação',
    'Diversidade',
    'Comunicação',
    'Relacionamentos',
  ],
  Cantores: [
    'Sertanejo',
    'Samba e pagode',
    'MPB',
    'Rock',
    'Pop',
    'Gospel',
    'Forró',
    'Música infantil',
    'Funk',
    'Rap e hip-hop',
    'Música eletrônica',
  ],
  Humoristas: [
    'Stand-up',
    'Imitações',
    'Humor musical',
    'Improviso',
    'Humor digital',
  ],
  Artistas: [
    'Atores',
    'Apresentadores',
    'Mágicos',
    'Dançarinos',
    'Artistas circenses',
    'Literatura e escrita',
  ],
  Influenciadores: [
    'Gastronomia',
    'Beleza e moda',
    'Viagens',
    'Games',
    'Tecnologia',
    'Fitness',
    'Família',
    'Saúde e bem-estar',
    'Finanças',
    'Educação',
    'Fé e espiritualidade',
  ],
  'Infantil e família': [
    'Shows infantis',
    'Personagens e espetáculos licenciados',
    'Teatro de bonecos',
    'Contação de histórias',
    'Circo para a família',
  ],
  'Peças de teatro e musicais': [
    'Peças de teatro',
    'Musicais',
    'Monólogos',
    'Companhias de teatro',
  ],
  Gastronomia: [
    'Chefs e cozinheiros',
    'Festivais gastronômicos',
    'Oficinas culinárias',
    'Degustações',
    'Jantares temáticos',
  ],
};

export const categories = [
  'Cantores',
  'Humoristas',
  'Palestrantes',
  'Artistas',
  'Influenciadores',
  'Infantil e família',
  'Peças de teatro e musicais',
  'Gastronomia',
];

export const categoryDisplayLabels = {
  Cantores: 'Cantores e bandas',
  Humoristas: 'Humoristas e comediantes',
  Influenciadores: 'Criadores de conteúdo',
};

export function validTalentTopics(topics, selectedCategories = categories) {
  return (
    Array.isArray(topics) &&
    topics.length <= 60 &&
    topics.every(t => {
      if (typeof t !== 'string') return false;
      const [category, theme, extra] = t.split('|');
      return (
        !extra &&
        selectedCategories.includes(category) &&
        talentTaxonomy[category]?.includes(theme)
      );
    })
  );
}

export function talentTopicKeys(rows) {
  return [
    ...new Set(
      (rows || []).flatMap(r => (Array.isArray(r.subcategorias) ? r.subcategorias : []))
    ),
  ];
}

export function topicLabels(rows) {
  return talentTopicKeys(rows)
    .map(t => t.split('|').join(' · '))
    .join(', ');
}

export function suggestedBiographyTopics(profile) {
  const text = String(profile?.description || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const profileCategories = profile?.categorias || (profile?.categoria ? [profile.categoria] : []);
  const aliases = {
    'Stand-up': /\bstand[ -]?up\b/,
    Imitações: /\bimitador|\bimitacoes\b/,
    'Humor musical': /\bhumor musical\b/,
    Improviso: /\bimproviso|\bimprovisacao\b/,
    'Humor digital': /\bhumor digital\b/,
  };
  return profileCategories.flatMap(c =>
    (talentTaxonomy[c] || [])
      .filter(t => {
        const normalized = t
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
        return aliases[t] ? aliases[t].test(text) : text.includes(normalized);
      })
      .map(t => `${c}|${t}`)
  );
}
