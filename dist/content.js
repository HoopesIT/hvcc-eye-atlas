// Patient education copy. This experience uses a simplified schematic model.
// Descriptions are original summaries of the sources linked below.

const HOW_VISION_WORKS = 'https://www.nei.nih.gov/eye-health-information/healthy-vision/how-eyes-work';
const ABOUT_THE_EYE = 'https://www.nei.nih.gov/eye-health-information/healthy-vision/nei-for-kids/about-eye';
const EYE_PARTS = 'https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/cataracts/cataracts-and-eye';
const CHOROID_ANATOMY = 'https://www.mayoclinic.org/diseases-conditions/wet-macular-degeneration/symptoms-causes/syc-20351107';

export const MODEL_NOTE = 'A simplified schematic for learning. Colors, proportions, and spacing are adjusted to make the structures easier to explore.';

export const PARTS = [
  {
    id: 'cornea',
    name: 'Cornea',
    subtitle: 'The clear front window',
    description: 'The cornea is your eye’s clear, curved front covering. It bends incoming light, beginning the focusing process before light reaches the lens.',
    function: 'Bends incoming light',
    fact: 'The cornea and lens work together to focus light.',
    color: '#7bdff4',
    sourceUrl: HOW_VISION_WORKS,
  },
  {
    id: 'iris',
    name: 'Iris',
    subtitle: 'The colored light control',
    description: 'The iris is the colored ring around the pupil. It changes the pupil’s size to control how much light enters your eye.',
    function: 'Controls light entry',
    fact: 'The iris changes the size of the pupil.',
    color: '#62ccb7',
    sourceUrl: ABOUT_THE_EYE,
  },
  {
    id: 'pupil',
    name: 'Pupil',
    subtitle: 'The opening for light',
    description: 'The pupil is the opening in the center of the iris. Light passes through it on the way to the lens and retina.',
    function: 'Lets light through',
    fact: 'The pupil is an opening in the eye.',
    color: '#a3bbc8',
    sourceUrl: EYE_PARTS,
  },
  {
    id: 'lens',
    name: 'Lens',
    subtitle: 'The adjustable focus',
    description: 'The lens sits behind the iris. It works with the cornea to focus light onto the retina, helping you see nearby and distant objects.',
    function: 'Focuses light on the retina',
    fact: 'The lens sits behind the iris.',
    color: '#8dd9e5',
    sourceUrl: ABOUT_THE_EYE,
  },
  {
    id: 'vitreous',
    name: 'Vitreous',
    subtitle: 'The clear interior gel',
    description: 'The vitreous is the clear gel inside your eye. Light travels through this transparent gel on its way to the retina.',
    function: 'Fills the eye with clear gel',
    fact: 'The vitreous is a gel.',
    color: '#a7e8e5',
    sourceUrl: ABOUT_THE_EYE,
  },
  {
    id: 'retina',
    name: 'Retina',
    subtitle: 'The light-sensing layer',
    description: 'The retina lines the back of your eye. Its light-sensitive cells, called photoreceptors, change light into electrical signals that begin the message to your brain.',
    function: 'Turns light into signals',
    fact: 'Photoreceptors are the retina\'s light-sensitive cells.',
    color: '#f79d7d',
    sourceUrl: HOW_VISION_WORKS,
  },
  {
    id: 'choroid',
    name: 'Choroid',
    subtitle: 'The layer of blood vessels',
    description: 'The choroid is a layer rich in blood vessels. It sits between the retina and sclera at the back of your eye.',
    function: 'Carries blood behind the retina',
    fact: 'The choroid and retina are separate layers.',
    color: '#db6d76',
    sourceUrl: CHOROID_ANATOMY,
  },
  {
    id: 'sclera',
    name: 'Sclera',
    subtitle: 'The protective outer coat',
    description: 'The sclera is the white, firm outer coat of your eye. It protects the structures inside and helps the eye keep its shape.',
    function: 'Protects and supports the eye',
    fact: 'The sclera covers most of the eye\'s exterior.',
    color: '#e0e8e7',
    sourceUrl: EYE_PARTS,
  },
  {
    id: 'optic-nerve',
    name: 'Optic nerve',
    subtitle: 'The connection to the brain',
    description: 'The optic nerve carries electrical signals from the retina to the brain. Your brain interprets these messages as the images you see.',
    function: 'Carries visual messages to the brain',
    fact: 'It contains more than one million nerve fibers.',
    color: '#f4c585',
    sourceUrl: ABOUT_THE_EYE,
  },
];

export const VISION_STEPS = [
  {
    id: 'enter',
    title: 'Light enters',
    description: 'The cornea bends incoming light as it enters the eye.',
    partId: 'cornea',
  },
  {
    id: 'focus',
    title: 'The eye focuses',
    description: 'Light passes through the pupil and lens. The lens works with the cornea to focus it on the retina.',
    partId: 'lens',
  },
  {
    id: 'sense',
    title: 'Light becomes a signal',
    description: 'Photoreceptors in the retina convert light into electrical signals.',
    partId: 'retina',
  },
  {
    id: 'interpret',
    title: 'The brain builds the image',
    description: 'Signals travel along the optic nerve to the brain, which turns them into the images you see.',
    partId: 'optic-nerve',
  },
];

export const SOURCES = [
  { title: 'National Eye Institute: How the Eyes Work', url: HOW_VISION_WORKS },
  { title: 'National Eye Institute: About the Eye', url: ABOUT_THE_EYE },
  { title: 'National Eye Institute: Cataracts and the Eye', url: EYE_PARTS },
  { title: 'Mayo Clinic: Wet Macular Degeneration, Choroid Anatomy', url: CHOROID_ANATOMY },
];
