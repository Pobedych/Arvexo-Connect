import type { MetadataRoute } from "next";

const BASE_URL = "https://connect.arvexo.ru";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/instructions/", "/blog/"],
      disallow: ["/cabinet/", "/cabinet/checkout", "/admin"]
    },
    sitemap: `${BASE_URL}/sitemap.xml`
  };
}
