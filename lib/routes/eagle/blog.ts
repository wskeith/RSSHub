import { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import { isValidHost } from '@/utils/valid-host';
const cateList = new Set(['all', 'design-resources', 'learn-design', 'inside-eagle']);

export const route: Route = {
    path: '/blog/:cate?/:language?',
    categories: ['design'],
    example: '/eagle/blog/en',
    parameters: { cate: 'Category, get by URL, `all` by default', language: 'Language, `cn`, `tw`, `en`, `en` by default' },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: {
        source: ['cn.eagle.cool/blog'],
        target: '/blog',
    },
    name: 'Blog',
    maintainers: ['Fatpandac'],
    handler,
    url: 'cn.eagle.cool/blog',
};

async function handler(ctx) {
    let cate = ctx.req.param('cate') ?? 'all';
    let language = ctx.req.param('language') ?? 'cn';
    if (!isValidHost(cate) || !isValidHost(language)) {
        throw new Error('Invalid host');
    }
    if (!cateList.has(cate)) {
        language = cate;
        cate = 'all';
    }

    const host = `https://${language}.eagle.cool`;
    const url = `${host}/blog/${cate === 'all' ? '' : cate}`;

    const response = await got(url);
    const $ = load(response.data);
    const title = $('div.categories-list > div > div > div > ul > li.active').text();
    const list = $('div.post-item')
        .map((_index, item) => ({
            title: $(item).find('div.title').text(),
            link: new URL($(item).find('a').attr('href'), host).href,
            pubDate: parseDate($(item).find('div.metas > a > span').text().replace('・', '')),
        }))
        .get();

    const items = await Promise.all(
        list.map((item) =>
            cache.tryGet(item.link, async () => {
                const detailResponse = await got(item.link);

                const content = load(detailResponse.data);

                item.description = content('div.post-html').html();

                return item;
            })
        )
    );

    return {
        title: `eagle - ${title}`,
        link: url,
        item: items,
    };
}
