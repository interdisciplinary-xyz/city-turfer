import { act, create } from 'react-test-renderer';

import { useLocale } from '@/i18n';
import { useApp, useContainer } from '@/ui-kit/app-context';

import type { ActivityPlaceView, CityView } from '../../contract';
import { type ActivityPlace, useActivityPlace } from '../use-activity-place';

const app = { dataVersion: 0 };
const execute = jest.fn<Promise<ActivityPlaceView>, [string]>();
const container = { territory: { activityPlace: { execute } } };

jest.mock('@/ui-kit/app-context', () => ({ useApp: jest.fn(), useContainer: jest.fn() }));
jest.mock('@/i18n', () => ({ useLocale: jest.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const WARSAW = { id: 'pl-warsaw', name: 'Warsaw' } as CityView;

let seen: ActivityPlace | undefined;
function Probe({ id }: { id: string }) {
  seen = useActivityPlace(id);
  return null;
}

async function render(id = 'a1') {
  seen = undefined;
  await act(async () => {
    create(<Probe id={id} />);
  });
}

beforeEach(() => {
  jest.mocked(useApp).mockImplementation(() => app as unknown as ReturnType<typeof useApp>);
  jest.mocked(useContainer).mockImplementation(() => container as unknown as ReturnType<typeof useContainer>);
  jest.mocked(useLocale).mockReturnValue('en');
  execute.mockReset();
});

describe('useActivityPlace', () => {
  it('names the city in the app language and the district as it is', async () => {
    execute.mockResolvedValue({ city: WARSAW, district: 'Mokotów' });
    jest.mocked(useLocale).mockReturnValue('pl');
    await render();
    expect(execute).toHaveBeenCalledWith('a1');
    expect(seen).toEqual({ city: 'Warszawa', district: 'Mokotów' });
  });

  it('keeps the catalogue name in English', async () => {
    execute.mockResolvedValue({ city: WARSAW, district: null });
    await render();
    expect(seen).toEqual({ city: 'Warsaw', district: null });
  });

  it('is nowhere when the activity is in no city or the read fails', async () => {
    execute.mockResolvedValue({ city: null, district: null });
    await render();
    expect(seen).toEqual({ city: null, district: null });
    execute.mockRejectedValue(new Error('db'));
    await render('a2');
    expect(seen).toEqual({ city: null, district: null });
  });
});
