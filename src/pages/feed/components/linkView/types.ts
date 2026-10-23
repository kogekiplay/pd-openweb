/** LinkView initializes these fields before returning a preview to a feed publisher. */
export interface FeedLinkPreview {
  errorCode: string | number;
  title: string;
  desc: string;
  url: string;
  img: string;
  shortUrl?: string | undefined;
  flashUrl?: string | undefined;
  favico?: string | undefined;
  imgArr?: string[] | undefined;
  error?: string | undefined;
}
