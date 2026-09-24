import { pathCompletion } from 'src/utils/common';

export interface PriceTipProps {
  text?: string | undefined;
}

export default function PriceTip(props: PriceTipProps) {
  const { text } = props;
  const url = pathCompletion('/billingrules');
  return (
    <span>
      {text}
      {window.platformENV.isPlatform ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="mLeft5">
          {_l('查看扣费规则')}
        </a>
      ) : null}
    </span>
  );
}
