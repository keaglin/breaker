import { QueryClient } from "@tanstack/query-core";
import { useQuery } from "@tanstack/react-query";

export const CLIENT = new QueryClient();

// Example query function - replace with your actual data fetching logic
const fetchFeeds = async () => {
  console.log('fetchFeeds')
  const response = await fetch('http://localhost:3000/api/feeds');
  return response.json();
};

const fetchArticles = async () => {
  const response = await fetch('http://localhost:3000/api/articles');
  return response.json();
};

export const useFeeds = () => {
  return useQuery(
    {
      queryKey: ["feeds"],
      queryFn: fetchFeeds,
    },
    CLIENT
  );
};

// Add similar functions for articles if needed
export const useArticles = () => {
  return useQuery(
    {
      queryKey: ["articles"],
      queryFn: fetchArticles,
    },
    CLIENT
  );
};
