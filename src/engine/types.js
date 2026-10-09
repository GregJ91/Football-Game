/** Championship Manager 01/02-style attributes, each 1–20. */
export const TECHNICAL = ['crossing', 'dribbling', 'finishing', 'heading', 'longShots', 'marking', 'passing', 'tackling', 'technique'];
export const MENTAL = [
    'aggression', 'anticipation', 'bravery', 'creativity', 'decisions', 'determination', 'flair', 'offTheBall', 'positioning', 'teamwork', 'workRate',
];
export const PHYSICAL = ['acceleration', 'agility', 'jumping', 'pace', 'stamina', 'strength'];
export const GOALKEEPING = ['handling', 'reflexes', 'oneOnOnes', 'aerialAbility', 'kicking', 'communication'];
export const ATTRIBUTE_KEYS = [...TECHNICAL, ...MENTAL, ...PHYSICAL, ...GOALKEEPING];
