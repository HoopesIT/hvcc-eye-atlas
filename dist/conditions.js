// Original patient education summaries of the linked sources.
// Visible model changes are schematic design interpretations of the anatomy.

const KERATOCONUS = {
  title: 'Mayo Clinic: Keratoconus',
  url: 'https://www.mayoclinic.org/diseases-conditions/keratoconus/symptoms-causes/syc-20351352',
};
const ASTIGMATISM = {
  title: 'Mayo Clinic: Astigmatism',
  url: 'https://www.mayoclinic.org/diseases-conditions/astigmatism/symptoms-causes/syc-20353835',
};
const GLAUCOMA = {
  title: 'Mayo Clinic: Glaucoma',
  url: 'https://www.mayoclinic.org/diseases-conditions/glaucoma/symptoms-causes/syc-20372839',
};
const NERVE_HEAD = {
  title: 'AAO EyeWiki: Optic Nerve and Retinal Nerve Fiber Imaging',
  url: 'https://eyewiki.aao.org/Optic_Nerve_and_Retinal_Nerve_Fiber_Imaging',
};
const CATARACT = {
  title: 'Mayo Clinic: Cataracts',
  url: 'https://www.mayoclinic.org/diseases-conditions/cataracts/symptoms-causes/syc-20353790',
};

export const MODEL_CONDITION_NOTE = 'Schematic examples of selected structural changes. Shapes, colors, and spacing are simplified. They do not show diagnostic measurements, disease severity, or an individual person\'s vision.';

export const CONDITIONS = [
  {
    id: 'normal',
    name: 'Typical eye',
    partId: 'cornea',
    subtitle: 'A reference for comparison',
    description: 'Explore a simplified reference eye before comparing selected conditions. Its smooth corneal shape and clear lens provide a starting point for understanding the structural changes shown in the other views.',
    modelChange: 'Returns the cornea to a smooth dome and the lens to a clear appearance, with the reference optic nerve.',
    caution: 'A reference for comparison, not an individual eye or a test of eye health.',
    sourceUrls: [ASTIGMATISM, CATARACT],
    preferredView: 'cutaway',
    preferredExplode: 32,
  },
  {
    id: 'keratoconus',
    name: 'Keratoconus',
    partId: 'cornea',
    subtitle: 'A thinning, cone-shaped cornea',
    description: 'With keratoconus, the cornea becomes thinner and steeper, bulging outward into a cone shape. This can cause blurred or distorted vision and greater sensitivity to light and glare.',
    modelChange: 'Creates a localized cone-shaped bulge in the cornea.',
    caution: 'This illustrates surface shape, not corneal thickness. The exaggerated bulge does not represent a diagnostic stage.',
    sourceUrls: [KERATOCONUS],
    preferredView: 'exploded',
    preferredExplode: 60,
  },
  {
    id: 'astigmatism',
    name: 'Astigmatism',
    partId: 'cornea',
    subtitle: 'Unequal curves change the focus',
    description: 'Astigmatism occurs when the cornea or lens has unequal curves, preventing light from focusing evenly. This example changes the cornea, illustrating a surface that is more curved in one direction than the other.',
    modelChange: 'Makes the cornea smoothly steeper along one direction and flatter along the perpendicular direction.',
    caution: 'This shows a corneal example. Astigmatism can also come from the lens and does not require a cone-shaped cornea.',
    sourceUrls: [ASTIGMATISM],
    preferredView: 'exploded',
    preferredExplode: 60,
  },
  {
    id: 'glaucoma',
    name: 'Glaucoma',
    partId: 'optic-nerve',
    subtitle: 'Damage at the optic nerve',
    description: 'Glaucoma damages the optic nerve, which carries visual information to the brain. The damage is often linked to higher pressure inside the eye, but it can also occur when eye pressure is within the typical range.',
    modelChange: 'Shows a wider, deeper central cup and a thinner surrounding rim at the optic nerve head. An enlarged detail makes this small structure visible.',
    caution: 'The hollow illustrates optic nerve cupping. It is not a measured cup-to-disc ratio or a severity grade.',
    sourceUrls: [GLAUCOMA, NERVE_HEAD],
    preferredView: 'cutaway',
    preferredExplode: 15,
  },
  {
    id: 'cataract',
    name: 'Cataract',
    partId: 'lens',
    subtitle: 'Clouding inside the lens',
    description: 'A cataract makes the eye\'s natural lens cloudy. The clouding scatters or blocks light as it passes through the lens, making it harder for a clear image to reach the retina.',
    modelChange: 'Adds cloudy, softly yellowed opacity inside the lens behind the iris, while the cornea stays clear.',
    caution: 'Cataracts vary in location and appearance. This generalized lens clouding does not represent a specific type or severity.',
    sourceUrls: [CATARACT],
    preferredView: 'exploded',
    preferredExplode: 65,
  },
];
