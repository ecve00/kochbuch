// Beispieldaten für den Demo-Modus (ohne Supabase). Sie liegen nur in diesem Browser.
export function demoData() {
  const R1 = 'a1f0c3d2-0001-4000-8000-000000000001';
  const R2 = 'a1f0c3d2-0001-4000-8000-000000000002';
  const R3 = 'a1f0c3d2-0001-4000-8000-000000000003';
  const t = (d) => `2026-10-${d}T10:00:00.000Z`;
  return {
    recipes: [
      {
        id: R1, title: 'Burrata mit Ofentomaten', category: 'Vorspeise', servings: 4, totalMin: 35, tags: ['vegetarisch', 'Sommer'], rating: 4,
        source: '', notes: 'Tomaten lassen sich gut vorbereiten und lauwarm servieren.',
        ingredients: [
          { qty: 500, unit: 'g', name: 'Kirschtomaten' }, { qty: 3, unit: 'EL', name: 'Olivenöl' }, { qty: 1, unit: 'Zehe', name: 'Knoblauch' },
          { qty: 2, unit: 'Stk', name: 'Burrata' }, { qty: 1, unit: 'Bund', name: 'Basilikum' }, { qty: null, unit: '', name: 'Salz, Pfeffer, Flockensalz' },
        ],
        steps: [
          'Ofen auf 200 °C Umluft vorheizen.', 'Tomaten mit Öl, gehacktem Knoblauch, Salz und Pfeffer mischen.',
          'Tomaten 20 Min. rösten, bis sie aufplatzen.', 'Burrata halbieren, Tomaten darüber verteilen.', 'Mit Basilikum und Flockensalz servieren.',
        ],
        createdAt: t(20), updatedAt: t(20),
      },
      {
        id: R2, title: 'Pilzrisotto', category: 'Hauptgericht', servings: 4, totalMin: 45, tags: ['vegetarisch', 'Herbst'], rating: 5, source: '', notes: '',
        ingredients: [
          { qty: 400, unit: 'g', name: 'Champignons' }, { qty: 1, unit: 'Stk', name: 'Zwiebel' }, { qty: 300, unit: 'g', name: 'Risottoreis' },
          { qty: 150, unit: 'ml', name: 'Weißwein' }, { qty: 1, unit: 'l', name: 'Gemüsebrühe' }, { qty: 60, unit: 'g', name: 'Parmesan' }, { qty: 2, unit: 'EL', name: 'Butter' },
        ],
        steps: [
          'Brühe in einem Topf heiß halten.', 'Pilze in Butter scharf anbraten, 5 Min., herausnehmen.', 'Zwiebel fein würfeln und 3 Min. glasig dünsten.',
          'Reis zugeben, kurz rösten und mit Wein ablöschen.', 'Nach und nach Brühe angießen und unter Rühren 18 Minuten garen.',
          'Pilze, Parmesan und Butter unterziehen, 2 Min. ruhen lassen.',
        ],
        createdAt: t(21), updatedAt: t(21),
      },
      {
        id: R3, title: 'Schokoladenmousse', category: 'Dessert', servings: 6, totalMin: 30, tags: ['vorbereiten'], rating: 0, source: '', notes: 'Mindestens 4 Stunden kühlen.',
        ingredients: [
          { qty: 200, unit: 'g', name: 'Zartbitterschokolade' }, { qty: 4, unit: 'Stk', name: 'Eier' }, { qty: 200, unit: 'ml', name: 'Sahne' },
          { qty: 2, unit: 'EL', name: 'Zucker' }, { qty: 1, unit: 'Prise', name: 'Salz' },
        ],
        steps: [
          'Schokolade über dem Wasserbad schmelzen und 10 Min. abkühlen lassen.', 'Eier trennen, Eigelb unter die Schokolade rühren.', 'Sahne steif schlagen.',
          'Eiweiß mit Salz und Zucker steif schlagen.', 'Sahne und Eischnee vorsichtig unterheben.', 'In Gläser füllen und kalt stellen.',
        ],
        createdAt: t(22), updatedAt: t(22),
      },
    ],
    comments: [{ id: 'a1f0c3d2-0002-4000-8000-000000000001', recipeId: R1, text: 'Mit geröstetem Brot noch besser.', at: '2026-10-20T19:30:00.000Z' }],
    menus: [{
      id: 'a1f0c3d2-0003-4000-8000-000000000001', name: 'Herbstabend', date: '2026-11-07', guests: 6,
      courses: [{ recipeId: R1, course: 'Vorspeise' }, { recipeId: R2, course: 'Hauptgang' }, { recipeId: R3, course: 'Dessert' }],
      createdAt: t(23), updatedAt: t(23),
    }],
    shopping: [],
    progress: [],
    log: [
      [R2, 'Pilzrisotto', 'Hauptgericht', '2026-09-06'], [R1, 'Burrata mit Ofentomaten', 'Vorspeise', '2026-09-13'],
      [R2, 'Pilzrisotto', 'Hauptgericht', '2026-09-27'], [R3, 'Schokoladenmousse', 'Dessert', '2026-10-04'],
      [R1, 'Burrata mit Ofentomaten', 'Vorspeise', '2026-10-11'], [R2, 'Pilzrisotto', 'Hauptgericht', '2026-10-11'],
      [R3, 'Schokoladenmousse', 'Dessert', '2026-10-11'], [R2, 'Pilzrisotto', 'Hauptgericht', '2026-10-19'],
    ].map(([recipeId, title, category, d], i) => ({ id: `a1f0c3d2-0004-4000-8000-00000000000${i}`, recipeId, title, category, menuId: null, at: d + 'T19:00:00.000Z' })),
  };
}
