import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { searchWikiPage } from '../../api/wiki';

const WikiPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<{ title: string; content: string } | null>(null);

  useEffect(() => {
    const fetchPage = async () => {
      try {
        const result = await searchWikiPage(slug);
        setPage(result);
      } catch (error) {
        console.error(error);
      }
    };

    fetchPage();
  }, [slug]);

  if (!page) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>{page.title}</h1>
      <div>{page.content}</div>
    </div>
  );
};

export default WikiPage;
