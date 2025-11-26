// Collection of fun GIFs used for positive close notifications
export const gifs = [
  // existing one
  'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif',
  // user-provided Giphy pages converted to direct media links
  'https://media.giphy.com/media/HB4mYkjjFcvNm/giphy.gif',
  'https://media.giphy.com/media/PtdOBG0BD9Vvi/giphy.gif',
  'https://media.giphy.com/media/rFPH6jKnrAKU8/giphy.gif'
];

export function randomGif() {
  return gifs[Math.floor(Math.random() * gifs.length)];
}
