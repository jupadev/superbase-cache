import { createClient } from "@supabase/supabase-js";
import { IRequest, Router, RouterType } from "itty-router";
import { json, missing, withContent } from "itty-router-extras";
import { readFrom, writeTo } from "./utils/cache";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANNON_KEY: string;
  supabase: KVNamespace;
}

const router: RouterType = Router();
const ARTICLES_TABLE = "articles";

router.get(
  "/articles",
  async (
    _: IRequest,
    { SUPABASE_URL, SUPABASE_ANNON_KEY, supabase: supabaseStore }: Env
  ) => {
    const cachedArticles = await readFrom(supabaseStore, "/articles");
    if (cachedArticles) {
      return json(cachedArticles);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANNON_KEY);
    // it just to simulate request delay
    const data = await new Promise((resolve) => {
      setTimeout(async () => {
        const { data } = await supabase.from(ARTICLES_TABLE).select("*");
        resolve(data);
      }, 3000);
    });

    await writeTo(supabaseStore, "/articles", data);
    return json(data);
  }
);

router.get(
  "/articles/:id",
  async (
    request: IRequest,
    { SUPABASE_URL, SUPABASE_ANNON_KEY, supabase: supabaseStore }: Env
  ) => {
    const { id } = request.params;
    const cachedArticle = await readFrom(supabaseStore, `/articles/${id}`);
    if (cachedArticle) {
      return json(cachedArticle);
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANNON_KEY);
    const { data } = await supabase
      .from(ARTICLES_TABLE)
      .select("*")
      .match({ id })
      .single();
    if (data) {
      await writeTo(supabaseStore, `/articles/${id}`, data);
    }

    return !data ? missing("article not found") : json(data);
  }
);

router.post(
  "/revalidate",
  withContent,
  async (
    request: IRequest,
    { SUPABASE_URL, SUPABASE_ANNON_KEY, supabase: supabaseStore }: Env,
    context
  ) => {
    const updateCache = async () => {
      const { type, record, old_record } = request.content;
      console.log("URL", request.url);
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANNON_KEY);
      if (type === "INSERT" || type === "UPDATE") {
        const { data: article } = await supabase
          .from(ARTICLES_TABLE)
          .select("*")
          .match({ id: record.id })
          .single();
        await writeTo(supabaseStore, `/articles/${record.id}`, article);
      }

      if (type === "DELETE") {
        await supabaseStore.delete(`/articles/${old_record.id}`);
      }

      const { data: articles } = await supabase
        .from(ARTICLES_TABLE)
        .select("*");
      await writeTo(supabaseStore, "/articles", articles);
    };

    context.waitUntil(updateCache());
    return json({ received: true });
  }
);

// 404 for everything else
router.all("*", () =>
  missing("Oops! we can't find the page you're looking for :(")
);

export default {
  fetch: router.handle,
};
