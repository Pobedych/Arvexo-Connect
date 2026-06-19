import type { MetadataRoute } from "next";

const BASE_URL = "https://connect.arvexo.ru";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: `${BASE_URL}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: `${BASE_URL}/instructions/iphone`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7
    },
    {
      url: `${BASE_URL}/instructions/android`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7
    },
    {
      url: `${BASE_URL}/instructions/windows`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.6
    },
    {
      url: `${BASE_URL}/blog/kak-obojti-blokirovki-v-rossii-2026`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6
    },
    {
      url: `${BASE_URL}/blog/reality-vs-hysteria`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6
    },
    {
      url: `${BASE_URL}/blog/vpn-ne-rabotaet-chto-delat`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6
    },
    {
      url: `${BASE_URL}/blog/vpn-dlya-youtube-instagram-discord`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3
    }
  ];
}
