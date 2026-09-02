UPDATE `media_relations` SET `type` = 'mainStory' WHERE `type` = 'parentStory';--> statement-breakpoint
UPDATE `media_relations` SET `type` = 'alternativeVersion' WHERE `type` = 'alternative';--> statement-breakpoint
UPDATE `media_relations` SET `type` = 'crossMedia' WHERE `type` = 'mediaMix';
