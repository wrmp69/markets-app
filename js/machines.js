export const MACHINES = Object.freeze([

  {nom:"Chest Press",                            groupe:"Pectoraux", icon:"🏋️‍♂️",poids:[4.5,11,18,25,32,39,45,52,59,66,73,79,86,93,100,107,113], video:"2DwxvvQScEg"},
  {nom:"Pec Fly",                                groupe:"Pectoraux", icon:"🏋️‍♂️",poids:[4.5,11,18,25,32,39,45,52,59,66,73,79,86,93,100,107,113,120,127,134], video:"jRQ0cKGdNMs"},
  {nom:"Développé couché haltères",              groupe:"Pectoraux", icon:"🏋️‍♂️",poids:[1,2,3,4,5,6,7,8,9,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40], video:""},
  {nom:"Développé incliné Smith machine",        groupe:"Pectoraux", icon:"🏋️‍♂️",poids:[10,12.5,15,17.5,20,22.5,25,27.5,30,32.5,35,37.5,40,42.5,45,47.5,50], video:""},
  {nom:"Développé incliné haltères",             groupe:"Pectoraux", icon:"🏋️‍♂️",poids:[1,2,3,4,5,6,7,8,9,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40], video:""},

  {nom:"Abducteurs machine",                     groupe:"Jambes",    icon:"🦵",poids:[4.3,11,18,25,32,39,45,52,59,66,73,79,86,93,100], video:"https://res.cloudinary.com/dcrqklxw2/video/upload/v1777843748/ABDUCTEURS_arqh0x.mp4"},
  {nom:"Adducteurs machine",                     groupe:"Jambes",    icon:"🦵",poids:[4.3,11,18,25,32,39,45,52,59,66,73,79,86,93,100], video:"https://res.cloudinary.com/dcrqklxw2/video/upload/v1777843753/ADDUCTEURS_b87ulb.mp4"}, 
  {nom:"Goblet squat?",                          groupe:"Jambes",    icon:"🦵",poids:[10,15,20,25,30,35,40,45,50,55,60], video:""},
  {nom:"Hack squat?",                            groupe:"Jambes",    icon:"🦵",poids:[20,30,40,50,60,70,80,90,100,120], video:""},
  {nom:"Leg curl assis",                         groupe:"Jambes",    icon:"🦵",poids:[4.3,11,18,25,32,39,45,52,59,66,73,79,86,93,100,107,113], video:"https://res.cloudinary.com/dcrqklxw2/video/upload/v1777843164/LEG_CURL_ASSIS_oomm5u.mp4"}, 
  {nom:"Leg curl couché",                        groupe:"Jambes",    icon:"🦵",poids:[4.3,11,18,25,32,39,45,52,59,66,73,79,86,93,100,107,113], video:"https://res.cloudinary.com/dcrqklxw2/video/upload/v1777843161/LEG_CURL_ALLONG%C3%89_hz9ike.mp4"},
  {nom:"Leg extension",                          groupe:"Jambes",    icon:"🦵",poids:[4.3,11,18,25,32,39,45,52,59,66,73,79,86,93,100,107,113], video:"https://res.cloudinary.com/dcrqklxw2/video/upload/v1777843118/LEG_EXTENSION_rfjn9s.mp4"},
  {nom:"Presse convergente?",                    groupe:"Jambes",    icon:"🦵",poids:[20,25,30,35,40,45,50,55,60,65,70,75,80], video:""},
  {nom:"Squat Smith machine?",                   groupe:"Jambes",    icon:"🦵",poids:[20,30,40,50,60,70,80,90,100,110,120], video:""},

  {nom:"Deltoïde arrière (Rev fly)",             groupe:"Épaules",   icon:"🛡️",poids:[4.5,11,18,25,32,39,45,52,59,66,73,79,86,93,100,107,113,120,127,134], video:"jRQ0cKGdNMs?t=78"},
  {nom:"Développé militaire Smith machine",      groupe:"Épaules",   icon:"🛡️",poids:[10,12.5,15,17.5,20,22.5,25,27.5,30,32.5,35,37.5,40,42.5,45,47.5,50], video:""},
  {nom:"Développé militaire haltères",           groupe:"Épaules",   icon:"🛡️",poids:[1,2,3,4,5,6,7,8,9,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40], video:""},
  {nom:"Élévation frontale haltères",            groupe:"Épaules",   icon:"🛡️",poids:[1,2,3,4,5,6,7,8,9,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40], video:""},
  {nom:"Élévation latérale haltères",            groupe:"Épaules",   icon:"🛡️",poids:[1,2,3,4,5,6,7,8,9,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40], video:""},
  {nom:"Élévation latérale poulie",              groupe:"Épaules",   icon:"🛡️",poids:[2.3,4.5,6.8,9,11.3,13.5,15.8,18,20.3,22.5,24.8,27,29.3,31.5,33.8,36,38.3,40.5,42.8,45], video:""},

  {nom:"Extension lombaire",                     groupe:"Dos",       icon:"🧗‍♂️",poids:[80], video:""},
  {nom:"Traction",                               groupe:"Dos",       icon:"🧗‍♂️",poids:[80], video:""},
  {nom:"Traction assistée",                      groupe:"Dos",       icon:"🧗‍♂️",poids:[4.5,9,14,18,23,27,32,36,41,45,52,59,66,73,79,86,93,100,107,113], video:""},
  {nom:"Tirage divergent",                	   	 groupe:"Dos",       icon:"🧗‍♂️",poids:[4.5,9,14,18,23,27,32,36,41,45,52,59,66,73,79,86,93,100,107,113], video:""},
  {nom:"Tirage horizontal prise neutre",         groupe:"Dos",       icon:"🧗‍♂️",poids:[2.3,4.5,6.8,9,11.3,13.5,15.8,18,20.3,22.5,24.8,27,29.3,31.5,33.8,36,38.3,40.5,42.8,45], video:""},
  {nom:"Tirage horizontal prise serrée",         groupe:"Dos",       icon:"🧗‍♂️",poids:[2.3,4.5,6.8,9,11.3,13.5,15.8,18,20.3,22.5,24.8,27,29.3,31.5,33.8,36,38.3,40.5,42.8,45], video:""},
  {nom:"Tirage horizontal machine",              groupe:"Dos",       icon:"🧗‍♂️",poids:[4.5,11,18,25,32,39,45,52,59,66,73,79,86,93,100,107,113,120,127,134], video:""},
  {nom:"Tirage menton barre EZ?",                groupe:"Dos",       icon:"🧗‍♂️",poids:[4.5,9,14,18,23,27,32,36,41,45,52,59,66,73,79,86,93,100,107,113], video:""},
  {nom:"Tirage vertical machine?",               groupe:"Dos",       icon:"🧗‍♂️",poids:[4.5,11,18,25,32,39,45,52,59,66,73,79,86,93,100,107,113,120,127,134], video:""},
  {nom:"Tirage vertical pronation prise large",  groupe:"Dos",       icon:"🧗‍♂️",poids:[4.5,11,18,25,32,39,45,52,59,66,73,79,86,93,100,107,113,120,127,134], video:""},
  {nom:"Tirage vertical supination prise serrée",groupe:"Dos",       icon:"🧗‍♂️",poids:[4.5,11,18,25,32,39,45,52,59,66,73,79,86,93,100,107,113,120,127,134], video:""},

  {nom:"Curl pupitre",                           groupe:"Biceps",    icon:"🦾",poids:[4.5,9,14,18,23,27,32,36,41,45,50,54,59,64,68,73,77,82,86,91], video:""},
  {nom:"Curl haltère banc incliné",              groupe:"Biceps",    icon:"🦾",poids:[5,6,7,8,9,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40], video:""},
  {nom:"Curl marteau unilatéral",                groupe:"Biceps",    icon:"🦾",poids:[5,6,7,8,9,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40], video:""},
  {nom:"Curl marteau",                           groupe:"Biceps",    icon:"🦾",poids:[1,2,3,4,5,6,7,8,9,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40], video:"https://res.cloudinary.com/dcrqklxw2/video/upload/v1777844986/CURL_BICEPS_uibw11.mp4"},
  {nom:"Curl biceps barre EZ",                   groupe:"Biceps",    icon:"🦾",poids:[10,15,20,25,30,35], video:""},
  {nom:"Curl biceps à la poulie",                groupe:"Biceps",    icon:"🦾",poids:[2.3,4.5,6.8,9,11.3,13.5,15.8,18,20.3,22.5,24.8,27,29.3,31.5,33.8,36,38.3,40.5,42.8,45], video:""},
  {nom:"Curl marteau corde",                     groupe:"Biceps",    icon:"🦾",poids:[2.3,4.5,6.8,9,11.3,13.5,15.8,18,20.3,22.5,24.8,27,29.3,31.5,33.8,36,38.3,40.5,42.8,45], video:""},

  {nom:"Dips lesté?",                            groupe:"Triceps",   icon:"🔱",poids:[1,2,3,4,5,6,7,8,9,10,15,20,25,30,35,40,45,50,55,60], video:""},
  {nom:"Dips non lesté PDC",                     groupe:"Triceps",   icon:"🔱",poids:[80], video:""},
  {nom:"Dips Press",                             groupe:"Triceps",   icon:"🔱",poids:[4.5,9,14,18,23,27,32,36,41,45,50,54,59,64,68,73,77,82,86,91], video:""},
  {nom:"Extension triceps barre poulie",         groupe:"Triceps",   icon:"🔱",poids:[2.3,4.5,6.8,9,11.3,13.5,15.8,18,20.3,22.5,24.8,27,29.3,31.5,33.8,36,38.3,40.5,42.8,45], video:""},
  {nom:"Extension triceps corde poulie",         groupe:"Triceps",   icon:"🔱",poids:[2.3,4.5,6.8,9,11.3,13.5,15.8,18,20.3,22.5,24.8,27,29.3,31.5,33.8,36,38.3,40.5,42.8,45], video:"https://res.cloudinary.com/dcrqklxw2/video/upload/v1777844982/EXTENSION_TRICEPS_%C3%80_LA_CORDE_lri7ks.mp4"},
  {nom:"Extension triceps haltères front",       groupe:"Triceps",   icon:"🔱",poids:[1,2,3,4,5,6,7,8,9,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40], video:""},
  {nom:"Triceps barre front EZ",                 groupe:"Triceps",   icon:"🔱",poids:[10,15,20,25,30,35], video:""},
  {nom:"Triceps barre front poulie",             groupe:"Triceps",   icon:"🔱",poids:[2.3,4.5,6.8,9,11.3,13.5,15.8,18,20.3,22.5,24.8,27,29.3,31.5,33.8,36,38.3,40.5,42.8,45], video:""},

  {nom:"Crunch abdos corde poulie",              groupe:"Abdos",     icon:"🔥",poids:[2.3,4.5,6.8,9,11.3,13.5,15.8,18,20.3,22.5,24.8,27,29.3,31.5,33.8,36,38.3,40.5,42.8,45], video:""},
  {nom:"Crunch abdos machine?",                  groupe:"Abdos",     icon:"🔥",poids:[1,2,3,4,5,6,7,8,9,10,15,20,25,30,35,40,45,50,55,60], video:""},
  {nom:"Relevé de jambes PDC",                   groupe:"Abdos",     icon:"🔥",poids:[80], video:""},

  {nom:"Mollet presse?",                         groupe:"Mollets",   icon:"🐐",poids:[1,2,3,4,5,6,7,8,9,10,15,20,25,30,35,40,45,50,55,60], video:""},
  {nom:"Mollet presse Smith machine",            groupe:"Mollets",   icon:"🐐",poids:[10,15,20,25,30,35,40,45,50,55,60], video:""},

]);

export const GROUP_ICONS = Object.freeze({
  'Abdos': '🔥', 'Biceps': '🦾', 'Dos': '🧗‍♂️', 'Épaules': '🛡️',
  'Jambes': '🦵', 'Mollets': '🐐', 'Pectoraux': '🏋️‍♂️', 'Triceps': '🔱'
});

export const GROUPS = Object.keys(GROUP_ICONS);
