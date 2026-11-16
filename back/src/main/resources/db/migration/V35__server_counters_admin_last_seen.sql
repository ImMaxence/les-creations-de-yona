-- 2.21.0. The counters of the whole server with each measure of the curves, which only ever grow (they
-- start again from 0 when the server, or the gateway, restarts): processor time in ticks, all of it and the
-- idle part (/proc/stat), bytes of the server's network card, bytes the gateway received and sent for the
-- site. Two measures in a row give the load, the estimated draw and the traffic between them. Absent when
-- they could not be read (a backend run outside Docker).
ALTER TABLE server_sample
    ADD COLUMN cpu_total_ticks     bigint CHECK (cpu_total_ticks >= 0),
    ADD COLUMN cpu_idle_ticks      bigint CHECK (cpu_idle_ticks >= 0),
    ADD COLUMN host_received_bytes bigint CHECK (host_received_bytes >= 0),
    ADD COLUMN host_sent_bytes     bigint CHECK (host_sent_bytes >= 0),
    ADD COLUMN site_received_bytes bigint CHECK (site_received_bytes >= 0),
    ADD COLUMN site_sent_bytes     bigint CHECK (site_sent_bytes >= 0);

-- The last time an admin was seen in the back-office, every 5 minutes at most: a session lasts 7 days
-- without use, so the last sign-in can be weeks old for someone who comes every day.
ALTER TABLE admin_account ADD COLUMN last_seen_at timestamptz;
