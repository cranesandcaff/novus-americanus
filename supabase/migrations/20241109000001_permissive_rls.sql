-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users on essays" ON public.essays;
DROP POLICY IF EXISTS "Allow all operations for authenticated users on sources" ON public.sources;
DROP POLICY IF EXISTS "Allow all operations for authenticated users on essay_sources" ON public.essay_sources;

-- Create permissive policies allowing all operations for everyone
CREATE POLICY "Allow all operations on essays"
    ON public.essays
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on sources"
    ON public.sources
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on essay_sources"
    ON public.essay_sources
    FOR ALL
    USING (true)
    WITH CHECK (true);
